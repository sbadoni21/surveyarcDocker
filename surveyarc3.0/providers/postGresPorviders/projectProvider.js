"use client";
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { getCookie } from "cookies-next";
import projectModel from "@/models/postGresModels/projectModel";
const ProjectContext = createContext(undefined);

export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const orgId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const v = getCookie("currentOrgId");
    return v ? String(v) : null;
  }, [typeof window !== "undefined" ? getCookie("currentOrgId") : null]);

  // ===== LOAD ALL =====
  const fetchProjects = async () => {
    if (!orgId) return [];
    const data = await projectModel.getAll(orgId);
    setProjects(Array.isArray(data) ? data : []);
    return data;
  };

  useEffect(() => { fetchProjects(); }, [orgId]);

  // ===== CORE =====
  const getAllProjects = fetchProjects;

  const getProjectById = async (projectId) => {
    if (!orgId) return null;
    const data = await projectModel.getById(orgId, projectId);
    setSelectedProject(data || null);
    return data;
  };

  const createProject = async (data) => {
    // data must include: projectId, orgId, name, ownerUID, description?
    const created = await projectModel.create(data);
    setProjects((prev) => [...prev, created]);
    return created;
  };

  const updateProject = async (projectId, patch) => {
    if (!orgId) return null;
    const updated = await projectModel.update(orgId, projectId, patch);
    setProjects((prev) =>
      prev.map((p) => (p.projectId === projectId || p.project_id === projectId ? updated : p))
    );
    if (selectedProject && (selectedProject.projectId === projectId || selectedProject.project_id === projectId)) {
      setSelectedProject(updated);
    }
    return updated;
  };

  const deleteProject = async (projectId) => {
    if (!orgId) return;
    await projectModel.deleteProject(orgId, projectId);
    setProjects((prev) =>
      prev.filter((p) => (p.projectId || p.project_id) !== projectId)
    );
    if (selectedProject && (selectedProject.projectId === projectId || selectedProject.project_id === projectId)) {
      setSelectedProject(null);
    }
  };

  // ===== MEMBERS =====
  const addMember = async (projectId, member) => {
    if (!orgId) return;
    await projectModel.addMember(orgId, projectId, member);
    await getProjectById(projectId);
  };
  const updateMember = async (projectId, memberUid, memberUpdate) => {
    if (!orgId) return;
    await projectModel.updateMember(orgId, projectId, memberUid, memberUpdate);
    await getProjectById(projectId);
  };
  const removeMember = async (projectId, memberUid) => {
    if (!orgId) return;
    await projectModel.removeMember(orgId, projectId, memberUid);
    await getProjectById(projectId);
  };
   const bulkAddMembers = useCallback(async (projectId, userUids, role = "contributor") => {
    if (!userUids || userUids.length === 0) {
      throw new Error("No user IDs provided");
    }

    try {
      const result = await projectModel.bulkAddMembers(projectId, userUids, role);
      
      // Optionally refresh the project to get updated members list
      const updated = await projectModel.get(projectId);
      
      // Update local state if you're caching projects
      setProjects((prev) =>
        prev.map((p) => (p.projectId === projectId ? updated : p))
      );

      return result;
    } catch (error) {
      console.error("[ProjectProvider] bulkAddMembers error:", error);
      throw error;
    }
  }, []);

  /**
   * Bulk remove members from a project
   * @param {string} projectId - Project ID
   * @param {string[]} userUids - Array of user UIDs to remove
   */
  const bulkRemoveMembers = useCallback(async (projectId, userUids) => {
    if (!userUids || userUids.length === 0) {
      throw new Error("No user IDs provided");
    }

    try {
      const result = await projectModel.bulkRemoveMembers(projectId, userUids);
      
      // Optionally refresh the project
      const updated = await projectModel.get(projectId);
      
      // Update local state
      setProjects((prev) =>
        prev.map((p) => (p.projectId === projectId ? updated : p))
      );

      return result;
    } catch (error) {
      console.error("[ProjectProvider] bulkRemoveMembers error:", error);
      throw error;
    }
  }, []);

  // ===== SURVEYS =====
  const addSurveyId = async (projectId, surveyId) => {
    if (!orgId) return;
    // If you prefer batch: await projectModel.patchSurveys(orgId, projectId, { add: [surveyId] })
    await projectModel.addSurveyId(orgId, projectId, surveyId);
    await getProjectById(projectId);
  };
  const removeSurveyId = async (projectId, surveyId) => {
    if (!orgId) return;
    // If you prefer batch: await projectModel.patchSurveys(orgId, projectId, { remove: [surveyId] })
    await projectModel.removeSurveyId(orgId, projectId, surveyId);
    await getProjectById(projectId);
  };

  // ===== MILESTONES / TAGS / ATTACHMENTS =====
  const addMilestone = async (projectId, milestone) => {
    if (!orgId) return;
    await projectModel.addMilestone(orgId, projectId, milestone);
    await getProjectById(projectId);
  };
  const patchMilestone = async (projectId, mid, patch) => {
    if (!orgId) return;
    await projectModel.patchMilestone(orgId, projectId, mid, patch);
    await getProjectById(projectId);
  };
  const deleteMilestone = async (projectId, mid) => {
    if (!orgId) return;
    await projectModel.deleteMilestone(orgId, projectId, mid);
    await getProjectById(projectId);
  };

  const patchTags = async (projectId, { add = [], remove = [] }) => {
    if (!orgId) return;
    await projectModel.patchTags(orgId, projectId, { add, remove });
    await getProjectById(projectId);
  };

  const addAttachment = async (projectId, attachment) => {
    if (!orgId) return;
    await projectModel.addAttachment(orgId, projectId, attachment);
    await getProjectById(projectId);
  };
  const removeAttachment = async (projectId, aid) => {
    if (!orgId) return;
    await projectModel.removeAttachment(orgId, projectId, aid);
    await getProjectById(projectId);
  };

  // ===== STATUS / TIMELINE / PROGRESS =====
  const setStatus = async (projectId, status, reason) => {
    if (!orgId) return;
    await projectModel.setStatus(orgId, projectId, { status, reason });
    await getProjectById(projectId);
  };
  const getTimeline = async (projectId) => {
    if (!orgId) return { milestones: [], activities: [] };
    return await projectModel.timeline(orgId, projectId);
  };
  const recomputeProgress = async (projectId) => {
    if (!orgId) return;
    const res = await projectModel.recomputeProgress(orgId, projectId);
    await getProjectById(projectId);
    return res;
  };

  // ===== SEARCH / BULK / FAVORITES =====
  const searchProjects = async (query) => {
    if (!orgId) return { total: 0, count: 0, items: [] };
    return await projectModel.search(orgId, query);
  };
  const bulkProjects = async (body) => {
    if (!orgId) return { ok: false };
    const res = await projectModel.bulk(orgId, body);
    await fetchProjects(); // list likely changed
    return res;
  };
  const listFavorites = async (userId) => {
    console.log(userId)
    if (!orgId) return { count: 0, items: [] };
    return await projectModel.listFavorites(orgId,userId);
  };
  const addFavorite = async (userId, projectId) => {
    if (!orgId) return;
    return await projectModel.addFavorite(orgId, userId, projectId);
  };
  const removeFavorite = async (userId, projectId) => {
    if (!orgId) return;
    return await projectModel.removeFavorite(orgId, userId, projectId);
  };

  return (
    <ProjectContext.Provider
      value={{
        // state
        bulkAddMembers, bulkRemoveMembers,
        projects, selectedProject, setSelectedProject,
        // loads
        fetchProjects, getAllProjects, getProjectById,
        // core
        createProject, updateProject, deleteProject,
        // members
        addMember, updateMember, removeMember,
        // surveys
        addSurveyId, removeSurveyId, // or use patchSurveys via model if batching
        // milestones/tags/attachments
        addMilestone, patchMilestone, deleteMilestone,
        patchTags, addAttachment, removeAttachment,
        // status/timeline/progress
        setStatus, getTimeline, recomputeProgress,
        // org-scope
        searchProjects, bulkProjects, listFavorites, addFavorite, removeFavorite,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
