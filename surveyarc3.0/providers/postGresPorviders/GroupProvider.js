// providers/postGresPorviders/GroupProvider.jsx
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import GroupModel from "@/models/postGresModels/groupModel";
import { useUser } from "@/providers/postGresPorviders/UserProvider"; // 👈 import your user provider

const GroupContext = createContext();

export const GroupProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [membersCache, setMembersCache] = useState({}); // keyed by groupId
  const [loading, setLoading] = useState(false);

  // 👇 adjust depending on how your UserProvider looks
  const { user } = useUser?.() || {};
  const currentUserId = user?.uid || user?.user_id || user?.id;

  // ---------- LOAD GROUPS BY ORG ----------
  const loadGroups = useCallback(
    async (orgId) => {
      if (!orgId || !currentUserId) return [];
      setLoading(true);

      try {
        const data = await GroupModel.listByOrg(orgId, currentUserId);
        setGroups(data);
        return data;
      } finally {
        setLoading(false);
      }
    },
    [currentUserId]
  );

  // ---------- CRUD GROUP ----------
  const createGroup = async (data) => {
    if (!currentUserId) {
      throw new Error("No current user id found for group creation");
    }

    // auto-inject user_id into data
    const created = await GroupModel.create({
      ...data,
      user_id: currentUserId,
    });

    setGroups((prev) => [created, ...prev]);
    return created;
  };

  const updateGroup = async (groupId, data) => {
    if (!currentUserId) {
      throw new Error("No current user id found for updating group");
    }

    const updated = await GroupModel.update(groupId, data, currentUserId);
    setGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));
    return updated;
  };

  const deleteGroup = async (groupId) => {
    if (!currentUserId) {
      throw new Error("No current user id found for deleting group");
    }

    await GroupModel.delete(groupId, currentUserId);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  // ---------- MEMBERS ----------
  const loadMembers = async (groupId) => {
    if (!currentUserId) return [];

    const members = await GroupModel.listMembers(groupId, currentUserId);
    setMembersCache((prev) => ({ ...prev, [groupId]: members }));
    return members;
  };

  const addMember = async (groupId, userUid, role = "member") => {
    if (!currentUserId) {
      throw new Error("No current user id found for adding member");
    }

    const m = await GroupModel.addMember(
      groupId,
      userUid,
      role,
      currentUserId
    );
    setMembersCache((prev) => ({
      ...prev,
      [groupId]: prev[groupId] ? [...prev[groupId], m] : [m],
    }));
    return m;
  };

  const updateMember = async (groupId, userUid, data) => {
    if (!currentUserId) {
      throw new Error("No current user id found for updating member");
    }

    const updated = await GroupModel.updateMember(
      groupId,
      userUid,
      data,
      currentUserId
    );
    setMembersCache((prev) => ({
      ...prev,
      [groupId]: prev[groupId]?.map((m) =>
        m.user_uid === userUid ? updated : m
      ),
    }));
    return updated;
  };

  const removeMember = async (groupId, userUid) => {
    if (!currentUserId) {
      throw new Error("No current user id found for removing member");
    }

    await GroupModel.removeMember(groupId, userUid, currentUserId);
    setMembersCache((prev) => ({
      ...prev,
      [groupId]: prev[groupId]?.filter((m) => m.user_uid !== userUid),
    }));
  };

  return (
    <GroupContext.Provider
      value={{
        groups,
        loading,
        loadGroups,
        createGroup,
        updateGroup,
        deleteGroup,
        loadMembers,
        addMember,
        updateMember,
        removeMember,
        membersCache,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroups = () => useContext(GroupContext);
