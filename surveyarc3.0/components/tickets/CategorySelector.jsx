// components/tickets/CategorySelector.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useTicketCategories } from "@/providers/postGresPorviders/TicketCategoryProvider";
import { useTicketTaxonomies } from "@/providers/postGresPorviders/TicketTaxonomyProvider";

/**
 * Props:
 * - orgId: string
 * - value: {
 *     category?: string, subcategory?: string, product?: string,
 *     featureId?: string, impactId?: string, rcaId?: string, rcaNote?: string
 *   }
 * - onChange(categoryId)
 * - onSubcategoryChange(subcategoryId)
 * - onProductChange(productId)
 * - onFeatureChange(featureId)
 * - onImpactChange(impactId)
 * - onRCAChange(rcaId)
 * - onRCANoteChange(text)
 */
export function CategorySelector({
  orgId,
  value = {},
  onChange,
  onSubcategoryChange,
  onProductChange,
  onFeatureChange,
  onImpactChange,
  onRCAChange,
  onRCANoteChange,
}) {
  const { listCategories, listSubcategories, listProducts } = useTicketCategories();
  const { listFeatures, listImpacts, listRootCauses } = useTicketTaxonomies();

  // Local UI state (initialize from value)
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [features, setFeatures] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [rcas, setRCAs] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState(value.category || "");
  const [selectedSubcategory, setSelectedSubcategory] = useState(value.subcategory || "");
  const [selectedProduct, setSelectedProduct] = useState(value.product || "");

  const [selectedFeature, setSelectedFeature] = useState(value.featureId || "");
  const [selectedImpact, setSelectedImpact] = useState(value.impactId || "");
  const [selectedRCA, setSelectedRCA] = useState(value.rcaId || "");
  const [rcaNote, setRcaNote] = useState(value.rcaNote || "");

  // Keep local state in sync if parent value changes
  useEffect(() => {
    setSelectedCategory(value.category || "");
    setSelectedSubcategory(value.subcategory || "");
    setSelectedProduct(value.product || "");
    setSelectedFeature(value.featureId || "");
    setSelectedImpact(value.impactId || "");
    setSelectedRCA(value.rcaId || "");
    setRcaNote(value.rcaNote || "");
  }, [value.category, value.subcategory, value.product, value.featureId, value.impactId, value.rcaId, value.rcaNote]);

  // Initial data load
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const [cats, prods, feats, imps, rcaTypes] = await Promise.all([
          listCategories(orgId),
          listProducts(orgId),
          listFeatures(orgId),
          listImpacts(orgId),
          listRootCauses(orgId),
        ]);
        setCategories(cats || []);
        setProducts(prods || []);
        setFeatures(feats || []);
        setImpacts(imps || []);
        setRCAs(rcaTypes || []);
      } catch (err) {
        console.error("CategorySelector: initial load failed", err);
      }
    })();
  }, [orgId, listCategories, listProducts, listFeatures, listImpacts, listRootCauses]);

  // Load subcategories when category changes
  useEffect(() => {
    if (!orgId || !selectedCategory) {
      setSubcategories([]);
      return;
    }
    (async () => {
      try {
        const subs = await listSubcategories(orgId, selectedCategory);
        setSubcategories(subs || []);
      } catch (err) {
        console.error("CategorySelector: loadSubcategories failed", err);
      }
    })();
  }, [orgId, selectedCategory, listSubcategories]);

  // Normalized option helpers (robust to API casing/keys)
  const norm = {
    categoryId: (o) => o.category_id ?? o.categoryId ?? o.id,
    subcategoryId: (o) => o.subcategory_id ?? o.subcategoryId ?? o.id,
    productId: (o) => o.product_id ?? o.productId ?? o.id,
    featureId: (o) => o.feature_id ?? o.featureId ?? o.id,
    impactId: (o) => o.impact_id ?? o.impactId ?? o.id,
    rcaId: (o) => o.rca_id ?? o.rcaId ?? o.id,
    name: (o) => o.name ?? o.title ?? "",
    code: (o) => o.code ?? o.slug ?? "",
    version: (o) => o.version ?? "",
    icon: (o) => o.icon ?? "",
  };

  // Handlers → lift state to parent
  const handleCategoryChange = (e) => {
    const id = e.target.value;
    setSelectedCategory(id);
    setSelectedSubcategory("");
    onChange?.(id || "");
    onSubcategoryChange?.("");
  };

  const handleSubcategoryChange = (e) => {
    const id = e.target.value;
    setSelectedSubcategory(id);
    onSubcategoryChange?.(id || "");
  };

  const handleProductChange = (e) => {
    const id = e.target.value;
    setSelectedProduct(id);
    onProductChange?.(id || "");
  };

  const handleFeatureChange = (e) => {
    const id = e.target.value;
    setSelectedFeature(id);
    onFeatureChange?.(id || "");
  };

  const handleImpactChange = (e) => {
    const id = e.target.value;
    setSelectedImpact(id);
    onImpactChange?.(id || "");
  };

  const handleRCAChange = (e) => {
    const id = e.target.value;
    setSelectedRCA(id);
    onRCAChange?.(id || "");
  };

  const handleRCANoteChange = (e) => {
    const v = e.target.value;
    setRcaNote(v);
    onRCANoteChange?.(v);
  };

  return (
    <div className="space-y-6">
      {/* Category / Subcategory / Product */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={norm.categoryId(cat)} value={norm.categoryId(cat)}>
                {norm.icon(cat) ? `${norm.icon(cat)} ` : ""}{norm.name(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Subcategory</label>
          <select
            value={selectedSubcategory}
            onChange={handleSubcategoryChange}
            disabled={!selectedCategory || subcategories.length === 0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select a subcategory...</option>
            {subcategories.map((sub) => (
              <option key={norm.subcategoryId(sub)} value={norm.subcategoryId(sub)}>
                {norm.name(sub)}
              </option>
            ))}
          </select>
        </div>

        {/* Product */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Product</label>
          <select
            value={selectedProduct}
            onChange={handleProductChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a product...</option>
            {products.map((prod) => {
              const id = norm.productId(prod);
              const name = norm.name(prod);
              const ver = norm.version(prod);
              return (
                <option key={id} value={id}>
                  {name}{ver ? ` (${ver})` : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Feature / Impact Area / Root Cause (+ note) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Feature */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Feature (optional)</label>
          <select
            value={selectedFeature}
            onChange={handleFeatureChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">— None —</option>
            {features.map((f) => {
              const id = norm.featureId(f);
              const name = norm.name(f);
              const code = norm.code(f);
              return (
                <option key={id} value={id}>
                  {name}{code ? ` — ${code}` : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Impact Area */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Impact Area (optional)</label>
          <select
            value={selectedImpact}
            onChange={handleImpactChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">— None —</option>
            {impacts.map((i) => {
              const id = norm.impactId(i);
              const name = norm.name(i);
              const code = norm.code(i);
              return (
                <option key={id} value={id}>
                  {name}{code ? ` — ${code}` : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Root Cause */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Root Cause (optional)</label>
          <select
            value={selectedRCA}
            onChange={handleRCAChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">— None —</option>
            {rcas.map((r) => {
              const id = norm.rcaId(r);
              const name = norm.name(r);
              const code = norm.code(r);
              return (
                <option key={id} value={id}>
                  {name}{code ? ` — ${code}` : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* RCA Note */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">RCA Note / Link (optional)</label>
        <input
          type="text"
          value={rcaNote}
          onChange={handleRCANoteChange}
          placeholder="Write a short note or paste a link"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}
