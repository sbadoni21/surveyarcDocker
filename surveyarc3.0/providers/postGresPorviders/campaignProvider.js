"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import CampaignModel from "@/models/postGresModels/campaignModel";
import { getCookie } from "cookies-next";
import { useOrganisation } from "./organisationProvider";

const CampaignContext = createContext();

export const CampaignProvider = ({ children }) => {
  const { organisation } = useOrganisation();

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    status: null,
    channel: null,
    surveyId: null,
    search: "",
  });

  const userId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return String(getCookie("currentUserId") || "");
  }, []);

  const orgId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return String(getCookie("currentOrgId") || "");
  }, []);

  // Load campaigns when org changes or filters change
  useEffect(() => {
    if (organisation?.org_id) {
      loadCampaigns();
    } else {
      setCampaigns([]);
    }
  }, [organisation?.org_id, pagination.page, filters]);

  const loadCampaigns = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    
    try {
      const data = await CampaignModel.getAll(
        {
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...filters,
        },
        userId
      );
      
      setCampaigns(data.items || []);
      setPagination(prev => ({
        ...prev,
        total: data.total,
        totalPages: data.totalPages,
      }));
    } catch (e) {
      console.error("Failed to load campaigns:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const open = (campaignId) => {
    setCurrentId(campaignId);
  };

  const createCampaign = () => {
    setCurrentId(null); 
  };

  /** CREATE */
  const create = async (campaignData) => {
    try {
      const created = await CampaignModel.create(campaignData, userId);
      
      setCampaigns(prev => [created, ...prev]);
      setCurrentId(created.campaignId);
      return created;
    } catch (e) {
      console.error("Failed to create campaign:", e);
      throw e;
    }
  };

  /** GET BY ID */
  const getById = async (campaignId) => {
    try {
      return await CampaignModel.get(campaignId, userId);
    } catch (e) {
      console.error("Failed to get campaign:", e);
      return null;
    }
  };

  /** UPDATE */
  const update = async (campaignId, updateData) => {
    try {
      const updated = await CampaignModel.update(campaignId, updateData, userId);
      
      setCampaigns(prev =>
        prev.map(c => (c.campaignId === campaignId ? updated : c))
      );
      
      return updated;
    } catch (e) {
      console.error("Failed to update campaign:", e);
      throw e;
    }
  };

  /** DELETE */
  const deleteCampaign = async (campaignId) => {
    try {
      await CampaignModel.delete(campaignId, userId);
      
      setCampaigns(prev => prev.filter(c => c.campaignId !== campaignId));
      
      if (currentId === campaignId) {
        setCurrentId(null);
      }
    } catch (e) {
      console.error("Failed to delete campaign:", e);
      throw e;
    }
  };

  /** SEND */
  const sendCampaign = async (campaignId, sendData) => {
    try {
      const result = await CampaignModel.send(campaignId, sendData, userId);
      
      // Reload to get updated status
      await loadCampaigns();
      
      return result;
    } catch (e) {
      console.error("Failed to send campaign:", e);
      throw e;
    }
  };

  /** PAUSE */
  const pauseCampaign = async (campaignId) => {
    try {
      const result = await CampaignModel.pause(campaignId, userId);
      
      setCampaigns(prev =>
        prev.map(c =>
          c.campaignId === campaignId ? { ...c, status: "paused" } : c
        )
      );
      
      return result;
    } catch (e) {
      console.error("Failed to pause campaign:", e);
      throw e;
    }
  };

  /** RESUME */
  const resumeCampaign = async (campaignId) => {
    try {
      const result = await CampaignModel.resume(campaignId, userId);
      
      setCampaigns(prev =>
        prev.map(c =>
          c.campaignId === campaignId ? { ...c, status: "sending" } : c
        )
      );
      
      return result;
    } catch (e) {
      console.error("Failed to resume campaign:", e);
      throw e;
    }
  };

  /** GET ANALYTICS */
  const getAnalytics = async (campaignId) => {
    try {
      return await CampaignModel.getAnalytics(campaignId, userId);
    } catch (e) {
      console.error("Failed to get analytics:", e);
      return null;
    }
  };

  /** GET RESULTS */
  const getResults = async (campaignId, params = {}) => {
    try {
      return await CampaignModel.getResults(campaignId, params, userId);
    } catch (e) {
      console.error("Failed to get results:", e);
      return { items: [], total: 0 };
    }
  };

  /** FILTER HELPERS */
  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      status: null,
      channel: null,
      surveyId: null,
      search: "",
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  /** PAGINATION HELPERS */
  const setPage = useCallback((page) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const nextPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      page: Math.min(prev.page + 1, prev.totalPages),
    }));
  }, []);

  const prevPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      page: Math.max(prev.page - 1, 1),
    }));
  }, []);

  const value = {
    campaigns,
    loading,
    error,
    currentId,
    pagination,
    filters,
    
    // Actions
    open,
    createCampaign,
    create,
    getById,
    update,
    deleteCampaign,
    sendCampaign,
    pauseCampaign,
    resumeCampaign,
    getAnalytics,
    getResults,
    
    // Filter/Pagination
    setFilter,
    clearFilters,
    setPage,
    nextPage,
    prevPage,
    
    refresh: loadCampaigns,
  };

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
};

export const useCampaign = () => {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
};