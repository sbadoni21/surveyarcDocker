"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import ProjectModel from "@/models/postGresModels/projectModel";
import { getCookie } from "cookies-next";

const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const model =  ProjectModel;

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const fetchProjects = async () => {
    const orgId = typeof window !== "undefined" ? getCookie("currentOrgId") : null;
    if (orgId) {
      const data = await model.getAll(orgId);
      setProjects(data || []);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const getAllProjects = async () => {
    const orgId = getCookie("currentOrgId") || null;
    const data = await model.getAll(orgId);
    setProjects(data || []);
    return data;
  };

  const getProjectById = async (projectId) => {
    const data = await model.getById(projectId); // orgId inferred from cookie
    setSelectedProject(data || null);
    return data;
  };

  const createProject = async (data) => {
    const created = await model.create(data);
    setProjects((prev) => [...prev, created]);
    return created;
  };

  const updateProject = async (projectId, updateData) => {
    const orgId = getCookie("currentOrgId") || null;
    const updated = await model.update(orgId, projectId, updateData);
    setProjects((prev) => prev.map((p) => (p.project_id === projectId ? { ...p, ...updated } : p)));
    return updated;
  };

  const deleteProject = async (orgId, projectId) => {
    await model.delete(orgId, projectId);
    setProjects((prev) => prev.filter((p) => p.project_id !== projectId));
  };

  const addMember = async (projectId, member) => {
    await model.addMember(projectId, member);
    await getProjectById(projectId);
  };

  const removeMember = async (projectId, memberUid) => {
    await model.removeMember(projectId, memberUid);
    await getProjectById(projectId);
  };

  const addSurveyId = async (projectId, surveyId) => {
    await model.addSurveyId(projectId, surveyId);
    await getProjectById(projectId);
  };

  const removeSurveyId = async (projectId, surveyId) => {
    await model.removeSurveyId(projectId, surveyId);
    await getProjectById(projectId);
  };

  return (
    <ProjectContext.Provider
      value={{
        fetchProjects,
        projects,
        selectedProject,
        getAllProjects,
        getProjectById,
        createProject,
        updateProject,
        deleteProject,
        addMember,
        removeMember,
        addSurveyId,
        removeSurveyId,
        setSelectedProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
