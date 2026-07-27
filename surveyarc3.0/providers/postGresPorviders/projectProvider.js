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

  const userId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const v = getCookie("currentUserId");
    return v ? String(v) : null;
  }, [typeof window !== "undefined" ? getCookie("currentUserId") : null]);

  // ===== LOAD ALL =====
  const fetchProjects = async () => {
    if (!orgId || !userId) return [];
    
    const data = await projectModel.getAll(orgId, userId);
    setProjects(Array.isArray(data) ? data : []);
    return data;
  };

  useEffect(() => { fetchProjects(); }, [orgId, userId]);

  // ===== CORE =====
  const getAllProjects = fetchProjects;

  const getProjectById = async (projectId) => {
    if (!orgId || !userId) return null;
    const data = await projectModel.getById(orgId, projectId, userId);
    setSelectedProject(data || null);
    return data;
  };

  const createProject = async (data) => {
    if (!userId) return null;
    console.log(data)
    const created = await projectModel.create({ ...data, userId });
    setProjects((prev) => [...prev, created]);
    return created;
  };

  const updateProject = async (projectId, patch) => {
    if (!orgId || !userId) return null;
    console.log(projectId)
    const updated = await projectModel.update(orgId, projectId, patch, userId);
    setProjects((prev) =>
      prev.map((p) => (p.projectId === projectId || p.project_id === projectId ? updated : p))
    );
    if (selectedProject && (selectedProject.projectId === projectId || selectedProject.project_id === projectId)) {
      setSelectedProject(updated);
    }
    return updated;
  };

  const deleteProject = async (projectId) => {
    if (!orgId || !userId) return;
    await projectModel.deleteProject(orgId, projectId, userId);
    setProjects((prev) =>
      prev.filter((p) => (p.projectId || p.project_id) !== projectId)
    );
    if (selectedProject && (selectedProject.projectId === projectId || selectedProject.project_id === projectId)) {
      setSelectedProject(null);
    }
  };

  // ===== MEMBERS =====
  const addMember = async (projectId, member) => {
    if (!orgId || !userId) return;
    await projectModel.addMember(orgId, projectId, member, userId);
    await getProjectById(projectId);
  };

  const updateMember = async (projectId, memberUid, memberUpdate) => {
    if (!orgId || !userId) return;
    await projectModel.updateMember(orgId, projectId, memberUid, memberUpdate, userId);
    await getProjectById(projectId);
  };

  const removeMember = async (projectId, memberUid) => {
    if (!orgId || !userId) return;
    await projectModel.removeMember(orgId, projectId, memberUid, userId);
    await getProjectById(projectId);
  };

  const bulkAddMembers = useCallback(async (projectId, userUids, role = "contributor") => {
    if (!userUids || userUids.length === 0) {
      throw new Error("No user IDs provided");
    }
    if (!userId) {
      throw new Error("User ID not available");
    }

    try {
      const result = await projectModel.bulkAddMembers(projectId, userUids, role, userId);
      
      const updated = await projectModel.get(projectId, userId);
      
      setProjects((prev) =>
        prev.map((p) => (p.projectId === projectId ? updated : p))
      );

      return result;
    } catch (error) {
      console.error("[ProjectProvider] bulkAddMembers error:", error);
      throw error;
    }
  }, [userId]);

  const bulkRemoveMembers = useCallback(async (projectId, userUids) => {
    if (!userUids || userUids.length === 0) {
      throw new Error("No user IDs provided");
    }
    if (!userId) {
      throw new Error("User ID not available");
    }

    try {
      const result = await projectModel.bulkRemoveMembers(projectId, userUids, userId);
      
      const updated = await projectModel.get(projectId, userId);
      
      setProjects((prev) =>
        prev.map((p) => (p.projectId === projectId ? updated : p))
      );

      return result;
    } catch (error) {
      console.error("[ProjectProvider] bulkRemoveMembers error:", error);
      throw error;
    }
  }, [userId]);

  // ===== SURVEYS =====
  const addSurveyId = async (projectId, surveyId) => {
    if (!orgId || !userId) return;
    await projectModel.addSurveyId(orgId, projectId, surveyId, userId);
    await getProjectById(projectId);
  };

  const removeSurveyId = async (projectId, surveyId) => {
    if (!orgId || !userId) return;
    await projectModel.removeSurveyId(orgId, projectId, surveyId, userId);
    await getProjectById(projectId);
  };

  // ===== MILESTONES / TAGS / ATTACHMENTS =====
  const addMilestone = async (projectId, milestone) => {
    if (!orgId || !userId) return;
    await projectModel.addMilestone(orgId, projectId, milestone, userId);
    await getProjectById(projectId);
  };

  const patchMilestone = async (projectId, mid, patch) => {
    if (!orgId || !userId) return;
    await projectModel.patchMilestone(orgId, projectId, mid, patch, userId);
    await getProjectById(projectId);
  };

  const deleteMilestone = async (projectId, mid) => {
    if (!orgId || !userId) return;
    await projectModel.deleteMilestone(orgId, projectId, mid, userId);
    await getProjectById(projectId);
  };

  const patchTags = async (projectId, { add = [], remove = [] }) => {
    if (!orgId || !userId) return;
    await projectModel.patchTags(orgId, projectId, { add, remove }, userId);
    await getProjectById(projectId);
  };

  const addAttachment = async (projectId, attachment) => {
    if (!orgId || !userId) return;
    await projectModel.addAttachment(orgId, projectId, attachment, userId);
    await getProjectById(projectId);
  };

  const removeAttachment = async (projectId, aid) => {
    if (!orgId || !userId) return;
    await projectModel.removeAttachment(orgId, projectId, aid, userId);
    await getProjectById(projectId);
  };

  // ===== STATUS / TIMELINE / PROGRESS =====
  const setStatus = async (projectId, status, reason) => {
    if (!orgId || !userId) return;
    await projectModel.setStatus(orgId, projectId, { status, reason }, userId);
    await getProjectById(projectId);
  };

  const getTimeline = async (projectId) => {
    if (!orgId || !userId) return { milestones: [], activities: [] };
    return await projectModel.timeline(orgId, projectId, userId);
  };

  const recomputeProgress = async (projectId) => {
    if (!orgId || !userId) return;
    const res = await projectModel.recomputeProgress(orgId, projectId, userId);
    await getProjectById(projectId);
    return res;
  };

  // ===== SEARCH / BULK / FAVORITES =====
  const searchProjects = async (query) => {
    if (!orgId || !userId) return { total: 0, count: 0, items: [] };
    return await projectModel.search(orgId, query, userId);
  };

  const bulkProjects = async (body) => {
    if (!orgId || !userId) return { ok: false };
    const res = await projectModel.bulk(orgId, body, userId);
    await fetchProjects();
    return res;
  };

  const listFavorites = async () => {
    if (!orgId || !userId) return { count: 0, items: [] };
    return await projectModel.listFavorites(orgId, userId);
  };

  const addFavorite = async (projectId) => {
    if (!orgId || !userId) return;
    return await projectModel.addFavorite(orgId, userId, projectId);
  };

  const removeFavorite = async (projectId) => {
    if (!orgId || !userId) return;
    return await projectModel.removeFavorite(orgId, userId, projectId);
  };

  return (
    <ProjectContext.Provider
      value={{
        // state
        projects, 
        selectedProject, 
        setSelectedProject,
        userId,
        orgId,
        // loads
        fetchProjects, 
        getAllProjects, 
        getProjectById,
        // core
        createProject, 
        updateProject, 
        deleteProject,
        // members
        addMember, 
        updateMember, 
        removeMember,
        bulkAddMembers, 
        bulkRemoveMembers,
        // surveys
        addSurveyId, 
        removeSurveyId,
        // milestones/tags/attachments
        addMilestone, 
        patchMilestone, 
        deleteMilestone,
        patchTags, 
        addAttachment, 
        removeAttachment,
        // status/timeline/progress
        setStatus, 
        getTimeline, 
        recomputeProgress,
        // org-scope
        searchProjects, 
        bulkProjects, 
        listFavorites, 
        addFavorite, 
        removeFavorite,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);