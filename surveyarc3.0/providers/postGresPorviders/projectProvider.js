"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { getCookie } from "cookies-next";
import projectModel from "@/models/projectModel";

const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const model = projectModel;

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);

  const getOrgId = () => {
    const orgId = getCookie("currentOrgId");
    if (!orgId) {
      throw new Error("No organization ID found. Please select an organization.");
    }
    return orgId;
  };

  const fetchProjects = async () => {
    try {
      const orgId = getCookie("currentOrgId");
      if (orgId) {
        setLoading(true);
        const data = await model.getAll(orgId);
        setProjects(data || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // ========== PROJECT OPERATIONS ==========

  const getAllProjects = async () => {
    const orgId = getOrgId();
    const data = await model.getAll(orgId);
    setProjects(data || []);
    return data;
  };

  const getProjectById = async (projectId) => {
    const orgId = getOrgId();
    const data = await model.getById(orgId, projectId);
    setSelectedProject(data || null);
    return data;
  };

  const createProject = async (data) => {
    const created = await model.create(data);
    setProjects((prev) => [...prev, created]);
    return created;
  };

  const updateProject = async (projectId, updateData) => {
    const orgId = getOrgId();
    const updated = await model.update(orgId, projectId, updateData);
    setProjects((prev) =>
      prev.map((p) => (p.project_id === projectId ? { ...p, ...updated } : p))
    );
    if (selectedProject?.project_id === projectId) {
      setSelectedProject((prev) => ({ ...prev, ...updated }));
    }
    return updated;
  };

  const deleteProject = async (projectId) => {
    const orgId = getOrgId();
    await model.delete(orgId, projectId);
    setProjects((prev) => prev.filter((p) => p.project_id !== projectId));
    if (selectedProject?.project_id === projectId) {
      setSelectedProject(null);
    }
  };

  // ========== MEMBER OPERATIONS ==========

  const getMembers = async (projectId) => {
    const orgId = getOrgId();
    return await model.getMembers(orgId, projectId);
  };

  const getMember = async (projectId, memberUid) => {
    const orgId = getOrgId();
    return await model.getMember(orgId, projectId, memberUid);
  };

  const addMember = async (projectId, member) => {
    const orgId = getOrgId();
    const updated = await model.addMember(orgId, projectId, member);

    setProjects((prev) =>
      prev.map((p) => (p.project_id === projectId ? updated : p))
    );
    if (selectedProject?.project_id === projectId) {
      setSelectedProject(updated);
    }
    return updated;
  };

  const updateMember = async (projectId, memberUid, memberUpdate) => {
    const orgId = getOrgId();
    const updated = await model.updateMember(orgId, projectId, memberUid, memberUpdate);

    setProjects((prev) =>
      prev.map((p) => (p.project_id === projectId ? updated : p))
    );
    if (selectedProject?.project_id === projectId) {
      setSelectedProject(updated);
    }
    return updated;
  };

  const removeMember = async (projectId, memberUid) => {
    const orgId = getOrgId();
    const updated = await model.removeMember(orgId, projectId, memberUid);

    setProjects((prev) =>
      prev.map((p) => (p.project_id === projectId ? updated : p))
    );
    if (selectedProject?.project_id === projectId) {
      setSelectedProject(updated);
    }
    return updated;
  };

  // ========== SURVEY OPERATIONS ==========

  const getSurveys = async (projectId) => {
    const orgId = getOrgId();
    return await model.getSurveys(orgId, projectId);
  };

  const addSurveyId = async (projectId, surveyId) => {
    const orgId = getOrgId();
    const updated = await model.addSurveyId(orgId, projectId, surveyId);

    setProjects((prev) =>
      prev.map((p) => (p.project_id === projectId ? updated : p))
    );
    if (selectedProject?.project_id === projectId) {
      setSelectedProject(updated);
    }
    return updated;
  };

  const removeSurveyId = async (projectId, surveyId) => {
    const orgId = getOrgId();
    const updated = await model.removeSurveyId(orgId, projectId, surveyId);

    setProjects((prev) =>
      prev.map((p) => (p.project_id === projectId ? updated : p))
    );
    if (selectedProject?.project_id === projectId) {
      setSelectedProject(updated);
    }
    return updated;
  };

  return (
    <ProjectContext.Provider
      value={{
        // State
        projects,
        selectedProject,
        loading,
        setSelectedProject,

        // Project operations
        fetchProjects,
        getAllProjects,
        getProjectById,
        createProject,
        updateProject,
        deleteProject,

        // Member operations
        getMembers,
        getMember,
        addMember,
        updateMember,
        removeMember,

        // Survey operations
        getSurveys,
        addSurveyId,
        removeSurveyId,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
};