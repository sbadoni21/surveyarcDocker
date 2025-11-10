// providers/postGresProviders/ticketTemplateProvider.jsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import TicketTemplateModel from "@/models/postGresModels/ticketTemplateModel";
import { useOrganisation } from "./organisationProvider";
import { getCookie } from "cookies-next";

const TicketTemplateContext = createContext();

export const TicketTemplateProvider = ({ children }) => {
  const { organisation } = useOrganisation();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /** ✅ Read from cookies ONLY ON CLIENT */
  const userId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return String(getCookie("currentUserId") || "");
  }, []);

  const orgId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return String(getCookie("currentOrgId") || "");
  }, []);

  /** ✅ Auto-load templates when organisation changes */
  useEffect(() => {
    if (organisation?.org_id) {
      loadTemplates(organisation.org_id);
    } else {
      setTemplates([]);
    }
  }, [organisation?.org_id]);

  const loadTemplates = async (orgId) => {
    if (!orgId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await TicketTemplateModel.getAllByOrg(orgId, userId);
      setTemplates(data || []);
    } catch (e) {
      console.error("Failed to load templates:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /** CREATE */
  const create = async (templateData) => {
    try {

      const created = await TicketTemplateModel.create({
        ...templateData,
        org_id: templateData.orgId,
        user_id:templateData.userId,
      });

      setTemplates((prev) => [...prev, created]);
      return created;
    } catch (e) {
      console.error("Failed to create template:", e);
      throw e;
    }
  };

  /** GET */
  const getById = async (templateId) => {
    try {
      return await TicketTemplateModel.get(templateId);
    } catch (e) {
      console.error("Failed to get template:", e);
      return null;
    }
  };

  /** UPDATE */
  const update = async (templateId, updateData) => {
    try {
      const updated = await TicketTemplateModel.update(templateId, updateData);

      setTemplates((prev) =>
        prev.map((t) => (t.templateId === templateId ? updated : t))
      );

      return updated;
    } catch (e) {
      console.error("Failed to update template:", e);
      throw e;
    }
  };

  /** DELETE */
  const deleteTemplate = async (templateId, userId) => {
    try {
      await TicketTemplateModel.delete(templateId,orgId,userId);
      setTemplates((prev) => prev.filter((t) => t.templateId !== templateId));
    } catch (e) {
      console.error("Failed to delete template:", e);
      throw e;
    }
  };

  /** DEACTIVATE */
  const deactivate = async (templateId) => {
    try {
      const updated = await TicketTemplateModel.deactivate(templateId);
      setTemplates((prev) =>
        prev.map((t) => (t.templateId === templateId ? updated : t))
      );
      return updated;
    } catch (e) {
      console.error("Failed to deactivate template:", e);
      throw e;
    }
  };

  /** ACTIVATE */
  const activate = async (templateId) => {
    try {
      const updated = await TicketTemplateModel.activate(templateId);
      setTemplates((prev) =>
        prev.map((t) => (t.templateId === templateId ? updated : t))
      );
      return updated;
    } catch (e) {
      console.error("Failed to activate template:", e);
      throw e;
    }
  };

  /** STATS */
  const getStats = async (templateId) => {
    try {
      return await TicketTemplateModel.getStats(templateId);
    } catch (e) {
      console.error("Failed to get template stats:", e);
      throw e;
    }
  };

  /** Create Ticket from Template */
  const createTicket = async (apiKey, ticketData) => {
    try {
      const ticket = await TicketTemplateModel.createTicket(apiKey, ticketData);

      const idx = templates.findIndex((t) => t.apiKey === apiKey);
      if (idx !== -1) {
        setTemplates((prev) => {
          const newArr = [...prev];
          newArr[idx] = {
            ...newArr[idx],
            usageCount: (newArr[idx].usageCount || 0) + 1,
            lastUsedAt: new Date().toISOString(),
          };
          return newArr;
        });
      }

      return ticket;
    } catch (e) {
      console.error("Failed to create ticket:", e);
      throw e;
    }
  };

  /** Regenerate Key */
  const regenerateApiKey = async (templateId) => {
    try {
      const result = await TicketTemplateModel.regenerateApiKey(templateId);

      setTemplates((prev) =>
        prev.map((t) =>
          t.templateId === templateId ? { ...t, apiKey: result.api_key } : t
        )
      );

      return result;
    } catch (e) {
      console.error("Failed to regenerate API key:", e);
      throw e;
    }
  };

  /** Helpers */
  const getActiveTemplates = () => templates.filter((t) => t.isActive);

  const getTemplatesByUsage = (limit = 10) => {
    return [...templates]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  };

  const searchTemplates = (query) => {
    if (!query) return templates;
    const q = query.toLowerCase();

    return templates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.subjectTemplate?.toLowerCase().includes(q)
    );
  };

  /** PREVIEW */
  const previewTemplate = (template, variables = {}) => {
    const substitute = (txt) =>
      txt.replace(/\{\{(\w+)\}\}/g, (_, v) => variables[v] ?? `{{${v}}}`);

    return {
      subject: substitute(template.subjectTemplate),
      description: template.descriptionTemplate
        ? substitute(template.descriptionTemplate)
        : null,
    };
  };

  const value = {
    templates,
    loading,
    error,

    create,
    getById,
    update,
    deleteTemplate,

    activate,
    deactivate,

    createTicket,
    getStats,
    regenerateApiKey,

    getActiveTemplates,
    getTemplatesByUsage,
    searchTemplates,
    previewTemplate,

    refresh: () => organisation?.org_id && loadTemplates(organisation.org_id),
  };

  return (
    <TicketTemplateContext.Provider value={value}>
      {children}
    </TicketTemplateContext.Provider>
  );
};

export const useTicketTemplate = () => {
  const context = useContext(TicketTemplateContext);
  if (!context)
    throw new Error("useTicketTemplate must be used within TicketTemplateProvider");
  return context;
};
