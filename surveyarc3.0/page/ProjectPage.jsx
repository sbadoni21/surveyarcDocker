"use client";

import React, { useEffect, useState } from "react";
import ProjectsList from "@/components/ProjectList";
import ProjectForm from "@/components/ProjectForm";
import { useProject } from "@/providers/postGresPorviders/projectProvider";
import { getCookie } from "cookies-next";
import { FaSpinner } from "react-icons/fa";

export default function ProjectPage() {
  const {
    getAllProjects,
    createProject,
    deleteProject,
    projects,
    updateProject,
    addMember,
    updateMember,
    removeMember,
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
    if (!searchQuery) return true;
    return project.name?.toLowerCase().includes(searchQuery.toLowerCase());
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
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    getAllProjects()
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

    const {
      members = [],
      ...directoryFields
    } = formData;

    try {
      if (editProject) {
        await updateProject(editProject.projectId, directoryFields);
        await syncProjectMembers(
          editProject.projectId,
          editProject.members || [],
          members,
          editProject.owner_uid || editProject.ownerUID || ownerUID,
          { addMember, updateMember, removeMember }
        );
      } else {
        const projectId = "proj_" + Math.random().toString(36).substring(2, 10);
        await createProject({
          ...directoryFields,
          orgId,
          ownerUID,
          projectId,
        });
        await syncProjectMembers(
          projectId,
          [],
          members,
          ownerUID,
          { addMember, updateMember, removeMember }
        );
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

async function syncProjectMembers(projectId, existingMembers, desiredMembers, ownerUid, actions) {
  const existingMap = new Map(
    (existingMembers || [])
      .filter((member) => member?.uid && member.uid !== ownerUid)
      .map((member) => [member.uid, member])
  );
  const desiredMap = new Map(
    (desiredMembers || [])
      .filter((member) => member?.uid && member.uid !== ownerUid)
      .map((member) => [member.uid, member])
  );

  for (const [uid, desired] of desiredMap.entries()) {
    const existing = existingMap.get(uid);
    if (!existing) {
      await actions.addMember(projectId, {
        uid,
        role: desired.role || "contributor",
        status: desired.status || "active",
      });
      continue;
    }

    if (
      existing.role !== desired.role ||
      (existing.status || "active") !== (desired.status || "active")
    ) {
      await actions.updateMember(projectId, uid, {
        role: desired.role || "contributor",
        status: desired.status || "active",
      });
    }
  }

  for (const [uid] of existingMap.entries()) {
    if (!desiredMap.has(uid)) {
      await actions.removeMember(projectId, uid);
    }
  }
}
