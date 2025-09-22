"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import ProjectModel from "@/models/projectModel";
import { getCookie } from "cookies-next";

const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const model = new ProjectModel();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const fetchProjects = async () => {
    const orgId =
      typeof window !== "undefined" ? getCookie("currentOrgId") : null;

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
    const data = await model.getById(projectId);
    setSelectedProject(data || null);
    return data;
  };

  const createProject = async (data) => {
    await model.create(data);
    const newProject = model.defaultData(data);
    setProjects((prev) => [...prev, newProject]);
  };

  const updateProject = async (projectId, updateData) => {
    const orgId = getCookie("currentOrgId") || null;
    await model.update(orgId, projectId, updateData);
    setProjects((prev) =>
      prev.map((p) => (p.projectId === projectId ? { ...p, ...updateData } : p))
    );
  };

  const deleteProject = async (orgId, projectId) => {
    await model.delete(orgId, projectId);
    setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
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
