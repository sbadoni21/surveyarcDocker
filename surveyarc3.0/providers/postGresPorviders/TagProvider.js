
// providers/TagProvider.jsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import TagModel from "@/models/postGresModels/tagModel";

const TagContext = createContext();

export const TagProvider = ({ children }) => {
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tagsByOrg, setTagsByOrg] = useState({});

  const list = useCallback(async (params) => {
    setLoading(true);
    try {
      const arr = await TagModel.list(params);
      setTags(arr);
      
      // Cache by org
      if (params.orgId) {
        setTagsByOrg(prev => ({ ...prev, [params.orgId]: arr }));
      }
      
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (tagId) => {
    const t = await TagModel.get(tagId);
    setSelectedTag(t);
    return t;
  }, []);

  const create = useCallback(async (data) => {
    const created = await TagModel.create(data);
    setTags(prev => [created, ...prev]);
    
    // Update org cache
    if (data.orgId) {
      setTagsByOrg(prev => ({
        ...prev,
        [data.orgId]: [created, ...(prev[data.orgId] || [])]
      }));
    }
    
    return created;
  }, []);

  const update = useCallback(async (tagId, patch) => {
    const updated = await TagModel.update(tagId, patch);
    setTags(prev => prev.map(t => t.tagId === tagId ? updated : t));
    setSelectedTag(prev => prev && prev.tagId === tagId ? updated : prev);
    
    // Update org cache
    if (updated.orgId) {
      setTagsByOrg(prev => ({
        ...prev,
        [updated.orgId]: (prev[updated.orgId] || []).map(t => t.tagId === tagId ? updated : t)
      }));
    }
    
    return updated;
  }, []);

  const remove = useCallback(async (tagId) => {
    const tagToDelete = tags.find(t => t.tagId === tagId) || selectedTag;
    await TagModel.remove(tagId);
    
    setTags(prev => prev.filter(t => t.tagId !== tagId));
    setSelectedTag(prev => prev && prev.tagId === tagId ? null : prev);
    
    // Update org cache
    if (tagToDelete?.orgId) {
      setTagsByOrg(prev => ({
        ...prev,
        [tagToDelete.orgId]: (prev[tagToDelete.orgId] || []).filter(t => t.tagId !== tagId)
      }));
    }
    
    return true;
  }, [tags, selectedTag]);

  const getCategories = useCallback(async (orgId) => {
    return TagModel.getCategories(orgId);
  }, []);

  const count = useCallback(async (params) => {
    return TagModel.count(params);
  }, []);

  const getCachedTags = useCallback((orgId) => {
    return tagsByOrg[orgId] || [];
  }, [tagsByOrg]);

  const value = {
    tags,
    selectedTag,
    setSelectedTag,
    loading,
    tagsByOrg,
    list,
    get,
    create,
    update,
    remove,
    getCategories,
    count,
    getCachedTags,
  };

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
};

export const useTags = () => {
  const context = useContext(TagContext);
  if (!context) {
    throw new Error("useTags must be used within TagProvider");
  }
  return context;
};