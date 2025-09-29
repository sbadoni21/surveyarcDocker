
// ============================================
// PROVIDER - providers/postGresProviders/TicketCategoryProvider.jsx
// ============================================

"use client";
import TicketCategoryModel from "@/models/postGresModels/ticketCategoryModel";
import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";

const CategoryCtx = createContext(null);

export const TicketCategoryProvider = ({ children }) => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map());

  const listCategories = useCallback(async (orgId) => {
    if (!orgId) return [];
    const key = `cat:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);
    
    setLoading(true);
    try {
      const arr = await TicketCategoryModel.listCategories(orgId);
      cacheRef.current.set(key, arr);
      setCategories(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const listSubcategories = useCallback(async (orgId, categoryId = null) => {
    if (!orgId && !categoryId) return [];
    const key = categoryId ? `sub:${categoryId}` : `sub:org:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);
    
    setLoading(true);
    try {
      const arr = await TicketCategoryModel.listSubcategories({ orgId, categoryId });
      cacheRef.current.set(key, arr);
      setSubcategories(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const listProducts = useCallback(async (orgId) => {
    if (!orgId) return [];
    const key = `prod:${orgId}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);
    
    setLoading(true);
    try {
      const arr = await TicketCategoryModel.listProducts(orgId);
      cacheRef.current.set(key, arr);
      setProducts(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const invalidateCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const value = useMemo(
    () => ({
      categories,
      subcategories,
      products,
      loading,
      listCategories,
      listSubcategories,
      listProducts,
      invalidateCache,
    }),
    [categories, subcategories, products, loading, listCategories, listSubcategories, listProducts, invalidateCache]
  );

  return <CategoryCtx.Provider value={value}>{children}</CategoryCtx.Provider>;
};

export const useTicketCategories = () => {
  const ctx = useContext(CategoryCtx);
  if (!ctx) throw new Error("useTicketCategories must be used within TicketCategoryProvider");
  return ctx;
};
