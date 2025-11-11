"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import ThemeModel from "@/models/postGresModels/themeModel";
import { getCookie } from "cookies-next";
import { useOrganisation } from "./organisationProvider";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const { organisation } = useOrganisation();

  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /** ✅ Cookies */
  const userId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return String(getCookie("currentUserId") || "");
  }, []);

  const orgId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return String(getCookie("currentOrgId") || "");
  }, []);

  /** ✅ Auto-load */
  useEffect(() => {
    if (organisation?.org_id) {
      loadThemes(organisation.org_id);
    } else {
      setThemes([]);
    }
  }, [organisation?.org_id]);

  const loadThemes = async (orgId) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await ThemeModel.getAllByOrg(orgId, userId);
      setThemes(data || []);
    } catch (e) {
      console.error("Failed to load themes:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /** CREATE */
  const create = async (themeData) => {
    try {
      
      const created = await ThemeModel.create({
        ...themeData,
        orgId:orgId,
        userId:userId,
      });

      setThemes((prev) => [...prev, created]);
      return created;
    } catch (e) {
      console.error("Failed to create theme:", e);
      throw e;
    }
  };

  /** GET */
  const getById = async (themeId) => {
    try {
      return await ThemeModel.get(themeId);
    } catch (e) {
      console.error("Failed to get theme:", e);
      return null;
    }
  };

  /** UPDATE */
  const update = async (themeId, updateData) => {
    try {
      const updated = await ThemeModel.update(themeId, updateData);

      setThemes((prev) =>
        prev.map((t) => (t.themeId === themeId ? updated : t))
      );

      return updated;
    } catch (e) {
      console.error("Failed to update theme:", e);
      throw e;
    }
  };

  /** DELETE */
  const deleteTheme = async (themeId, userId) => {
    try {
      await ThemeModel.deleteTheme(themeId, orgId, userId);
      setThemes((prev) => prev.filter((t) => t.themeId !== themeId));
    } catch (e) {
      console.error("Failed to delete theme:", e);
      throw e;
    }
  };

  /** SOFT DELETE */
  const deactivate = async (themeId) => {
    try {
      const updated = await ThemeModel.deactivate(themeId);

      setThemes((prev) =>
        prev.map((t) => (t.themeId === themeId ? updated : t))
      );

      return updated;
    } catch (e) {
      console.error("Failed to deactivate theme:", e);
      throw e;
    }
  };

  /** ACTIVATE */
  const activate = async (themeId) => {
    try {
      const updated = await ThemeModel.activate(themeId);

      setThemes((prev) =>
        prev.map((t) => (t.themeId === themeId ? updated : t))
      );

      return updated;
    } catch (e) {
      console.error("Failed to activate theme:", e);
      throw e;
    }
  };

  const getActiveThemes = () => themes.filter((t) => t.isActive);

  const searchThemes = (query) => {
    if (!query) return themes;

    const q = query.toLowerCase();

    return themes.filter((t) => t.name?.toLowerCase().includes(q));
  };

  const value = {
    themes,
    loading,
    error,

    create,
    getById,
    update,
    deleteTheme,

    activate,
    deactivate,

    getActiveThemes,
    searchThemes,

    refresh: () => organisation?.org_id && loadThemes(organisation.org_id),
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
