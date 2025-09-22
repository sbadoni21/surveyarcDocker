// providers/postGresPorviders/organisationProvider.jsx
"use client";
import organisationModel from "@/models/postGresModels/organisationModel";
import UserModel from "@/models/postGresModels/userModel";
import { getCookie } from "cookies-next";
import React, { createContext, useContext, useState, useEffect } from "react";

const OrganisationContext = createContext();

export const OrganisationProvider = ({ children }) => {
  const [organisation, setOrganisation] = useState(null);
  const [loading, setLoading] = useState(true);

  // hydrate from cookie
  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const orgId = getCookie("currentOrgId") || null;
        if (orgId) {
          const doc = await organisationModel.getById(orgId);
          if (doc) setOrganisation(doc);
        }
      } catch (e) {
        console.error("fetchOrg failed:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, []);

  const getById = async (orgId) => {
    try {
      return await organisationModel.getById(orgId);
    } catch (e) {
      console.error("getById failed:", e);
      return null;
    }
  };

  const setCurrentOrg = (org) => setOrganisation(org);

  const create = async (data) => {
    try {
      const created = await organisationModel.create(data);
      setOrganisation(created);
      return created;
    } catch (e) {
      console.error("create org failed:", e);
      throw e;
    }
  };

  const update = async (orgId, updateData) => {
    try {
      const updated = await organisationModel.update(orgId, updateData);
      setOrganisation(updated);
      return updated;
    } catch (e) {
      console.error("update org failed:", e);
      throw e;
    }
  };

  const softDelete = async (orgId) => {
    try {
      await organisationModel.softDelete(orgId);
      setOrganisation(null);
    } catch (e) {
      console.error("softDelete org failed:", e);
      throw e;
    }
  };


  const _now = () => new Date().toISOString();

  const addMember = async (orgId, member) => {
    const org = organisation?.org_id === orgId ? organisation : await getById(orgId);
    if (!org?.org_id) throw new Error("Organisation not found");

    const list = Array.isArray(org.team_members) ? [...org.team_members] : [];
    const idx = list.findIndex(
      (m) => m?.uid === member.uid || (!!member.email && m?.email === member.email)
    );
    const isNew = idx === -1;

    let next = list;
    const joinedAt = _now();
    if (isNew) {
      next = [
        ...list,
        {
          uid: member.uid,
          email: member.email || "",
          role: member.role || "member",
          status: member.status || "active",
          joinedAt,
        },
      ];
    } else {
      const prev = list[idx] || {};
      next = [...list];
      next[idx] = {
        ...prev,
        ...member,
        role: member.role || prev.role || "member",
        status: member.status || prev.status || "active",
        joinedAt: prev.joinedAt || joinedAt,
      };
    }

    const prevSize = parseInt(org.organisation_size || "0", 10);
    const nextSize = String((isNaN(prevSize) ? 0 : prevSize) + (isNew ? 1 : 0));

    // A) update org
    let updatedOrg;
    try {
      updatedOrg = await update(orgId, {
        team_members: next,
        organisation_size: nextSize,
        updated_at: _now(),
        last_activity: _now(),
      });
    } catch (e) {
      throw new Error(`Org update failed: ${e.message || e}`);
    }

    // B) merge org into user.org_ids (server unions the set)
    try {
      await UserModel.update(member.uid, { org_ids: [String(orgId)] });
    } catch (e) {
      // rollback org change
      try {
        const rolled = next.filter((m) => m?.uid !== member.uid);
        await update(orgId, {
          team_members: rolled,
          organisation_size: String(isNaN(prevSize) ? 0 : prevSize),
          updated_at: _now(),
        });
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
      throw new Error(`User update failed: ${e.message || e}`);
    }

    return updatedOrg;
  };

  /**
   * Remove a member from organisation.team_members
   * (does NOT remove org from user.org_ids; add a dedicated server route if you want that)
   */
  const removeMember = async (orgId, uidOrEmail) => {
    const org = organisation?.org_id === orgId ? organisation : await getById(orgId);
    if (!org?.org_id) throw new Error("Organisation not found");

    const list = Array.isArray(org.team_members) ? org.team_members : [];
    const before = list.length;
    const next = list.filter(
      (m) => m?.uid !== uidOrEmail && m?.email !== uidOrEmail
    );

    const prevSize = parseInt(org.organisation_size || String(before), 10);
    const afterSize = Math.max(
      (isNaN(prevSize) ? before : prevSize) - (before - next.length),
      0
    );

    const updated = await update(orgId, {
      team_members: next,
      organisation_size: String(afterSize),
      updated_at: _now(),
      last_activity: _now(),
    });

    return updated;
  };

  /**
   * Change a member’s role (owner-only guard should be handled at callsite or here)
   */
  const updateMemberRole = async (orgId, uid, role) => {
    const org = organisation?.org_id === orgId ? organisation : await getById(orgId);
    if (!org?.org_id) throw new Error("Organisation not found");

    const list = Array.isArray(org.team_members) ? [...org.team_members] : [];
    const idx = list.findIndex((m) => m?.uid === uid);
    if (idx === -1) throw new Error("Member not found");

    list[idx] = { ...list[idx], role: role || "member" };

    const updated = await update(orgId, {
      team_members: list,
      updated_at: _now(),
      last_activity: _now(),
    });

    return updated;
  };

  return (
    <OrganisationContext.Provider
      value={{
        organisation,
        loading,
        setCurrentOrg,
        getById,
        create,
        update,
        softDelete,
        // NEW
        addMember,
        removeMember,
        updateMemberRole,
      }}
    >
      {children}
    </OrganisationContext.Provider>
  );
};

export const useOrganisation = () => useContext(OrganisationContext);
