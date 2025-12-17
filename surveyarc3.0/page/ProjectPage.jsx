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

  // Check if current user is owner or admin (you may need to adjust this based on your user data structure)
  const [userRole, setUserRole] = useState(null);
  const [isOrgOwner, setIsOrgOwner] = useState(false);

  // Filter projects by user access and search query
  const filteredProjects = projects?.filter((project) => {
    // Apply search filter first
    const matchesSearch = project.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check multiple role variations for owner/admin
    const isOwnerOrAdmin = 
      userRole === "owner" || 
      userRole === "admin" || 
      userRole === "Owner" ||
      userRole === "Admin" ||
      isOrgOwner ||
      getCookie("isOwner") === "true" ||
      getCookie("isAdmin") === "true";
    
    // Owners and admins see all projects (only filtered by search)
    if (isOwnerOrAdmin) {
      return matchesSearch;
    }

    // For regular users, check if they have access to this project
    const hasAccess = 
      project.ownerUID === ownerUID || // User is the project owner
      project.members?.some(m => {
        const memberId = m?.uid || m?.user_id || m?.id || m;
        return memberId === ownerUID;
      }) || // User is in members array (checking different ID formats)
      project.teamMembers?.some(member => {
        const memberId = member?.uid || member?.user_id || member?.userId || member?.id;
        return memberId === ownerUID;
      }) || // User is in teamMembers
      project.assignedUsers?.includes(ownerUID); // User is in assignedUsers

    return hasAccess && matchesSearch;
  });

  useEffect(() => {
    setLoading(true);

    if (typeof window !== "undefined") {
      setOrgId(getCookie("currentOrgId"));
      setOwnerUID(getCookie("currentUserId"));
      
      // Get user role from various possible cookie names
      const role = getCookie("userRole") || getCookie("role");
      setUserRole(role);
      setIsOrgOwner(getCookie("isOwner") === "true" || getCookie("isOrgOwner") === "true");
      
      // Debug: Log the role information
      console.log("User Role:", role);
      console.log("Is Owner:", getCookie("isOwner"));
      console.log("Is Admin:", getCookie("isAdmin"));
      console.log("All cookies:", document.cookie);
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
      await deleteProject(projectId);
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
        <div className="px-4 py-2 w-[30%]">
          <h1 className="text-[34px] font-semibold m-0 dark:text-[#CBC9DE]">
            SurveyARC
          </h1>
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
            <FaSpinner className="animate-spin text-orange-500 dark:text-amber-300 text-4xl" />
          </div>
        )  : (
          <ProjectsList
            orgId={orgId}
            projects={filteredProjects}
            deleteProject={handleDeleteProject}
            onEditProject={handleEditProject}
            handleCreateProject={handleCreateProject}
            loading={loading}
          />
        )}
      </section>
    </div>
  );
}