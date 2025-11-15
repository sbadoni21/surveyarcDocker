"use client";

import React, { useEffect, useState } from "react";
import ProjectsList from "@/components/ProjectList";
import ProjectForm from "@/components/ProjectForm";
import { useProject } from "@/providers/postGresPorviders/projectProvider";
import { getCookie } from "cookies-next";
import { IoSearch } from "react-icons/io5";
import { FaSpinner } from "react-icons/fa";
import { FiPlus } from "react-icons/fi";

export default function ProjectPage() {
  const {
    getAllProjects,
    createProject,
    deleteProject,
    projects,
    updateProject,
  } = useProject();

  const [project, setProject] = useState(null);
  const [editProject, setEditProject] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [ownerUID, setOwnerUID] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toggle, setToggle] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects?.filter((project) =>
    project.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setLoading(true);

    if (typeof window !== "undefined") {
      setOrgId(getCookie("currentOrgId"));
      setOwnerUID(getCookie("currentUserId"));
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    getAllProjects(orgId)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleCreateProject = () => {
    setToggle(true);
    setProject(null);
  };

  const handleEditProject = (projectToEdit) => {
    setEditProject(projectToEdit);
    setToggle(true);
  };

  const handleDeleteProject = async (projectId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );
    if (!confirmDelete) return;

    setLoading(true);
    setError(null);
    try {
      await deleteProject( projectId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProject = async (formData) => {
    setLoading(true);
    setError(null);

    if (!orgId || !ownerUID) {
      setError(
        "Organization ID or User ID not found. Please refresh the page."
      );
      setLoading(false);
      return;
    }

    try {
      if (editProject) {
        await updateProject(editProject.id, formData);
      } else {
        const projectId = "proj_" + Math.random().toString(36).substring(2, 10);
        await createProject({ ...formData, orgId, ownerUID, projectId });
      }

      setToggle(false);
      setEditProject(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-amber-100 p-6">
      <header className="flex items-center justify-between gap-10 py-4 mb-8 w-full">
        <div className=" px-4 py-2 w-[30%] ">
          <h1 className="text-[24px] font-semibold m-0 dark:text-[#CBC9DE]">
            Survey Management
          </h1>
          
        </div>

        <div className="relative w-[50%]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IoSearch className="text-xl" />
          </span>
          <input
            type="search"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 h-12 rounded-lg bg-white dark:bg-[#121214] border border-white dark:border-[#1A1A1E] text-[14px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
          />
        </div>

        <div className="flex items-center w-[20%]">
          <button
            onClick={handleCreateProject}
            disabled={loading}
            className={`px-4 h-12 rounded-md flex justify-center items-center gap-2 font-semibold text-white transition-all duration-300 
        ${
          loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#ED7A13] shadow-md shadow-orange-500/25 hover:scale-105"
        }`}
          >
            <FiPlus className="text-xl" /> Create New Project
          </button>
        </div>
      </header>

      {toggle && (
        <ProjectForm
          initialData={project || editProject}
          onSubmit={handleSubmitProject}
          onCancel={() => setToggle(false)}
          loading={loading}
        />
      )}

      <section>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <FaSpinner className="animate-spin text-orange-500 dark:text-amber-300 text-4xl " />
          </div>
        ) : (
          <ProjectsList
            orgId={orgId}
            projects={filteredProjects}
            deleteProject={handleDeleteProject}
            onEditProject={handleEditProject}
          />
        )}
      </section>
    </div>
  );
}
