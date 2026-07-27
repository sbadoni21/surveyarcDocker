"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { getCookie } from "cookies-next";
import projectModel from "@/models/projectModel";

const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const model =  projectModel;

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const getIds = () => {
    if (typeof window === "undefined") {
      return { orgId: null, userId: null };
    }
    const orgId = getCookie("currentOrgId") || null;
    const rawUserId = getCookie("currentUserId");
    const userId =
      rawUserId && rawUserId !== "undefined" && rawUserId !== "null"
        ? String(rawUserId)
        : null;
    return { orgId, userId };
  };

  const fetchProjects = async () => {
    const { orgId, userId } = getIds();

    if (orgId && userId) {
      const data = await model.getAll(orgId, userId);
      setProjects(data || []);
      return data;
    }
    return [];
  };
  useEffect(() => {
    fetchProjects();
  }, []);

  const getAllProjects = async () => {
    const { orgId, userId } = getIds();
    if (!orgId || !userId) return [];
    const data = await model.getAll(orgId, userId);
    setProjects(data || []);
    return data;
  };

  const getProjectById = async (projectId) => {
    const { orgId, userId } = getIds();
    if (!orgId || !userId) return null;
    const data = await model.getById(orgId, projectId, userId);
    setSelectedProject(data || null);
    return data;
  };

  const createProject = async (data) => {
    const { userId } = getIds();
    if (!userId) return null;
    await model.create(data, userId);
    const newProject = model.defaultData(data);
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  };

  const updateProject = async (projectId, updateData) => {
    const { orgId, userId } = getIds();
    if (!orgId || !userId) return null;
    await model.update(orgId, projectId, updateData, userId);
    setProjects((prev) =>
      prev.map((p) => (p.projectId === projectId ? { ...p, ...updateData } : p))
    );
  };

  const deleteProject = async (orgId, projectId) => {
    const { userId } = getIds();
    if (!orgId || !projectId || !userId) return;
    await model.deleteProject(orgId, projectId, userId);
    setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
  };

  const addMember = async (projectId, member) => {
    const { orgId, userId } = getIds();
    if (!orgId || !userId) return;
    await model.addMember(orgId, projectId, member, userId);
    await getProjectById(projectId);
  };

  const removeMember = async (projectId, memberUid) => {
    const { orgId, userId } = getIds();
    if (!orgId || !userId) return;
    await model.removeMember(orgId, projectId, memberUid, userId);
    await getProjectById(projectId);
  };

  const addSurveyId = async (projectId, surveyId) => {
    const { orgId, userId } = getIds();
    if (!orgId || !userId) return;
    await model.addSurveyId(orgId, projectId, surveyId, userId);
    await getProjectById(projectId);
  };

  const removeSurveyId = async (projectId, surveyId) => {
    const { orgId, userId } = getIds();
    if (!orgId || !userId) return;
    await model.removeSurveyId(orgId, projectId, surveyId, userId);
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
