// components/admin/CategoryManagement.jsx
"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  Grid3x3,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Puzzle,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import TicketCategoryModel from "@/models/postGresModels/ticketCategoryModel";
import TaxonomyModel from "@/models/postGresModels/ticketTaxonomyModel";
import { usePathname } from "next/navigation";
import TagsPage from "@/components/tags/TagsPage";

export default function CategoryManagement() {
  const path = usePathname();
  const orgId = path.split("/")[3];
  const [activeTab, setActiveTab] = useState("categories");
  const [stats, setStats] = useState({
    categories: 0,
    subcategories: 0,
    products: 0,
    features: 0,
    impacts: 0,
    rootCauses: 0,
  });

  useEffect(() => {
    loadStats();
  }, [orgId]);

  const loadStats = async () => {
    try {
      const [cats, subs, prods, feats, imps, rcas] = await Promise.all([
        TicketCategoryModel.listCategories(orgId),
        TicketCategoryModel.listSubcategories({ orgId }),
        TicketCategoryModel.listProducts(orgId),
        TaxonomyModel.listFeatures(orgId),
        TaxonomyModel.listImpacts(orgId),
        TaxonomyModel.listRootCauses(orgId),
      ]);
      setStats({
        categories: cats.length,
        subcategories: subs.length,
        products: prods.length,
        features: feats.length,
        impacts: imps.length,
        rootCauses: rcas.length,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const tabs = [
    { id: "categories", label: "Categories", icon: Layers, count: stats.categories },
    { id: "subcategories", label: "Subcategories", icon: Grid3x3, count: stats.subcategories },
    { id: "products", label: "Products", icon: Package, count: stats.products },
    { id: "features", label: "Features / Functions", icon: Puzzle, count: stats.features },
    { id: "impacts", label: "Impact Areas", icon: Briefcase, count: stats.impacts },
    { id: "rootCauses", label: "Root Causes", icon: AlertTriangle, count: stats.rootCauses },
    { id: "tagsPage", label: "Tags", icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E]">
      <div className="mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Layers className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Category Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Organize tickets with categories, subcategories, products, features, impact areas, and root causes
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-[#242428] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1E]">
            <nav className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-6 py-4 text-sm font-semibold border-b-2 transition-all relative ${
                      isActive
                        ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-[#242428]"
                        : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#242428]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        isActive
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "categories" && <CategoriesTab orgId={orgId} onUpdate={loadStats} />}
            {activeTab === "subcategories" && <SubcategoriesTab orgId={orgId} />}
            {activeTab === "products" && <ProductsTab orgId={orgId} />}
            {activeTab === "features" && <FeaturesTab orgId={orgId} onUpdate={loadStats} />}
            {activeTab === "impacts" && <ImpactsTab orgId={orgId} onUpdate={loadStats} />}
            {activeTab === "rootCauses" && <RootCausesTab orgId={orgId} onUpdate={loadStats} />}
            {activeTab === "tagsPage" && <TagsPage />}
          </div>
        </div>
      </div>
    </div>
  );
}

// Categories Tab Component
function CategoriesTab({ orgId, onUpdate }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  useEffect(() => {
    loadCategories();
  }, [orgId]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await TicketCategoryModel.listCategories(orgId, true);
      setCategories(data);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId) => {
    if (!confirm("Delete this category and all its subcategories?")) return;
    
    try {
      await TicketCategoryModel.deleteCategory(categoryId);
      loadCategories();
    } catch (error) {
      alert("Failed to delete category: " + error.message);
    }
  };

  const toggleExpand = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Categories</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Main ticket categories with subcategories
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 font-semibold"
        >
          <Plus className="w-5 h-5" />
          Add Category
        </button>
      </div>

      <div className="space-y-3">
        {categories.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 dark:bg-[#1A1A1E] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No categories yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first category to organize tickets
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create First Category
            </button>
          </div>
        ) : (
          categories.map((category) => (
            <div
              key={category.categoryId}
              className="bg-white dark:bg-[#242428] border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-lg"
            >
              <div className="flex items-center gap-4 p-5">
                <button
                  onClick={() => toggleExpand(category.categoryId)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-2 transition-all"
                >
                  {expandedCategories.has(category.categoryId) ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
                
                {category.icon && (
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl border-2"
                    style={{ 
                      backgroundColor: `${category.color}15`,
                      borderColor: `${category.color}30`,
                      color: category.color 
                    }}
                  >
                    {category.icon}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {category.name}
                    </h3>
                    {category.active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </div>
                  {category.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {category.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Grid3x3 className="w-3.5 h-3.5" />
                      {category.subcategoryCount || 0} subcategories
                    </span>
                    <span>Order: {category.displayOrder}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(category);
                      setShowModal(true);
                    }}
                    className="p-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.categoryId)}
                    className="p-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {expandedCategories.has(category.categoryId) && (
                <div className="bg-gray-50 dark:bg-[#1A1A1E] p-5 border-t-2 border-gray-200 dark:border-gray-700">
                  <SubcategoryList categoryId={category.categoryId} orgId={orgId} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <CategoryModal
          orgId={orgId}
          category={editingCategory}
          onClose={() => {
            setShowModal(false);
            setEditingCategory(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingCategory(null);
            loadCategories();
          }}
        />
      )}
    </div>
  );
}

// Category Modal
function CategoryModal({ orgId, category, onClose, onSave }) {
  const [form, setForm] = useState({
    name: category?.name || "",
    description: category?.description || "",
    icon: category?.icon || "📁",
    color: category?.color || "#3b82f6",
    displayOrder: category?.displayOrder || 0,
    active: category?.active !== false,
    orgId: orgId
  });
  const [saving, setSaving] = useState(false);
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (category) {
        await TicketCategoryModel.updateCategory(category.categoryId, form);
      } else {
        await TicketCategoryModel.createCategory({ ...form, orgId });
      }
      onSave();
    } catch (error) {
      alert("Failed to save category: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#242428] rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {category ? "Edit Category" : "New Category"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1A1A1E] border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all"
              placeholder="e.g., Bug Reports"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1A1A1E] border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all resize-none"
              placeholder="Describe this category..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Icon (emoji)
              </label>
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="🐛"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1A1A1E] border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-2xl transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-[52px] px-2 py-2 bg-gray-50 dark:bg-[#1A1A1E] border-2 border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1A1A1E] border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all"
            />
          </div>

          {category && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#1A1A1E] rounded-xl">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="active" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Active Status
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Category"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Subcategory List (nested view)
function SubcategoryList({ categoryId, orgId }) {
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubcategories();
  }, [categoryId]);

  const loadSubcategories = async () => {
    setLoading(true);
    try {
      const data = await TicketCategoryModel.listSubcategories({ categoryId });
      setSubcategories(data);
    } catch (error) {
      console.error("Failed to load subcategories:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (subcategories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Grid3x3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No subcategories yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Subcategories ({subcategories.length})
      </h4>
      {subcategories.map((sub) => (
        <div
          key={sub.subcategoryId}
          className="flex items-center justify-between p-3 bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {sub.name}
              </span>
              {!sub.active && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold rounded">
                  Inactive
                </span>
              )}
            </div>
            {sub.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {sub.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
// Subcategories Tab (full management)
function SubcategoriesTab({ orgId }) {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  useEffect(() => {
    loadCategories();
    loadSubcategories();
  }, [orgId]);

  const loadCategories = async () => {
    try {
      const data = await TicketCategoryModel.listCategories(orgId);
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadSubcategories = async () => {
    setLoading(true);
    try {
      const data = await TicketCategoryModel.listSubcategories({ orgId }, true);
      setSubcategories(data);
    } catch (error) {
      console.error("Failed to load subcategories:", error);
      alert("Failed to load subcategories: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (subcategoryId) => {
    if (!confirm("Delete this subcategory?")) return;
    
    try {
      await TicketCategoryModel.deleteSubcategory(subcategoryId);
      loadSubcategories();
    } catch (error) {
      alert("Failed to delete subcategory: " + error.message);
    }
  };

  const filteredSubcategories = selectedCategoryFilter
    ? subcategories.filter(sub => sub.categoryId === selectedCategoryFilter)
    : subcategories;

  if (loading) {
    return <div className="text-center py-8">Loading subcategories...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.categoryId} value={cat.categoryId}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => {
            setEditingSubcategory(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Subcategory
        </button>
      </div>

      <div className="space-y-2">
        {filteredSubcategories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No subcategories yet. Add your first subcategory to get started.
          </div>
        ) : (
          filteredSubcategories.map((subcategory) => {
            const category = categories.find(c => c.categoryId === subcategory.categoryId);
            return (
              <div key={subcategory.subcategoryId} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{subcategory.name}</h3>
                    {category && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {category.icon} {category.name}
                      </span>
                    )}
                  </div>
                  {subcategory.description && (
                    <p className="text-sm text-gray-500 mt-1">{subcategory.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    {subcategory.defaultPriority && (
                      <span>Priority: {subcategory.defaultPriority}</span>
                    )}
                    {subcategory.defaultSeverity && (
                      <span>Severity: {subcategory.defaultSeverity}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingSubcategory(subcategory);
                      setShowModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subcategory.subcategoryId)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <SubcategoryModal
          orgId={orgId}
          categories={categories}
          subcategory={editingSubcategory}
          onClose={() => {
            setShowModal(false);
            setEditingSubcategory(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingSubcategory(null);
            loadSubcategories();
          }}
        />
      )}
    </div>
  );
}

// Subcategory Modal
function SubcategoryModal({ orgId, categories, subcategory, onClose, onSave }) {
  const [form, setForm] = useState({
    categoryId: subcategory?.categoryId || "",
    name: subcategory?.name || "",
    description: subcategory?.description || "",
    displayOrder: subcategory?.displayOrder || 0,
    defaultPriority: subcategory?.defaultPriority || "",
    defaultSeverity: subcategory?.defaultSeverity || "",
    defaultSlaId: subcategory?.defaultSlaId || "",
    active: subcategory?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.categoryId) {
      alert("Please select a category");
      return;
    }

    setSaving(true);
    try {
      if (subcategory) {
        await TicketCategoryModel.updateSubcategory(subcategory.subcategoryId, form);
      } else {
        await TicketCategoryModel.createSubcategory({ ...form, orgId });
      }
      onSave();
    } catch (error) {
      alert("Failed to save subcategory: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">
          {subcategory ? "Edit Subcategory" : "New Subcategory"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a category...</option>
              {categories.map(cat => (
                <option key={cat.categoryId} value={cat.categoryId}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Priority
              </label>
              <select
                value={form.defaultPriority}
                onChange={(e) => setForm({ ...form, defaultPriority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Severity
              </label>
              <select
                value={form.defaultSeverity}
                onChange={(e) => setForm({ ...form, defaultSeverity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                <option value="sev1">Low</option>
                <option value="sev2">Medium</option>
                <option value="sev3">High</option>
                <option value="sev4">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Order
            </label>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {subcategory && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                Active
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Products Tab
function ProductsTab({ orgId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    loadProducts();
  }, [orgId]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await TicketCategoryModel.listProducts(orgId, { includeInactive: true });
      setProducts(data);
    } catch (error) {
      console.error("Failed to load products:", error);
      alert("Failed to load products: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm("Delete this product?")) return;
    
    try {
      await TicketCategoryModel.deleteProduct(productId);
      loadProducts();
    } catch (error) {
      alert("Failed to delete product: " + error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Products</h2>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-gray-500">
            No products yet. Add your first product to get started.
          </div>
        ) : (
          products.map((product) => (
            <div key={product.productId} className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{product.name}</h3>
                  {product.version && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      v{product.version}
                    </span>
                  )}
                  {!product.active && (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">Code: {product.code}</p>
                {product.platform && (
                  <p className="text-xs text-gray-500 mt-1">Platform: {product.platform}</p>
                )}
                {product.description && (
                  <p className="text-sm text-gray-500 mt-2">{product.description}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingProduct(product);
                    setShowModal(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(product.productId)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <ProductModal
          orgId={orgId}
          product={editingProduct}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingProduct(null);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

// Product Modal
function ProductModal({ orgId, product, onClose, onSave }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    code: product?.code || "",
    description: product?.description || "",
    version: product?.version || "",
    platform: product?.platform || "",
    displayOrder: product?.displayOrder || 0,
    active: product?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (product) {
        await TicketCategoryModel.updateProduct(product.productId, form);
      } else {
        await TicketCategoryModel.createProduct({ ...form, orgId });
      }
      onSave();
    } catch (error) {
      alert("Failed to save product: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold mb-4">
          {product ? "Edit Product" : "New Product"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code *
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g., web-app, mobile-ios"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Version
              </label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="1.0.0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Platform
              </label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                <option value="web">Web</option>
                <option value="mobile">Mobile</option>
                <option value="desktop">Desktop</option>
                <option value="api">API</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Order
            </label>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {product && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                Active
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function FeaturesTab({ orgId, onUpdate }) {
  const [features, setFeatures] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterProduct, setFilterProduct] = useState("");

  useEffect(() => {
    loadAll();
  }, [orgId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [feats, prods] = await Promise.all([
        TaxonomyModel.listFeatures(orgId),
        TicketCategoryModel.listProducts(orgId),
      ]);
      setFeatures(feats);
      setProducts(prods);
      onUpdate?.();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this feature?")) return;
    await TaxonomyModel.deleteFeature(id);
    loadAll();
  };

  const filtered = filterProduct
    ? features.filter((f) => f.productId === filterProduct)
    : features;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShow(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Feature
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No features yet.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <div
              key={f.featureId}
              className="flex items-center justify-between p-4 bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-xl"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{f.name}</span>
                  {f.productId && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                      {products.find((p) => p.productId === f.productId)?.name || "Product"}
                    </span>
                  )}
                  {f.code && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      {f.code}
                    </span>
                  )}
                  {f.active ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Inactive</span>
                  )}
                </div>
                {f.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{f.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(f);
                    setShow(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(f.featureId)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && (
        <FeatureModal
          orgId={orgId}
          products={products}
          feature={editing}
          onClose={() => {
            setShow(false);
            setEditing(null);
          }}
          onSave={() => {
            setShow(false);
            setEditing(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function FeatureModal({ orgId, products, feature, onClose, onSave }) {
  const [form, setForm] = useState({
    name: feature?.name || "",
    description: feature?.description || "",
    code: feature?.code || "",
    productId: feature?.productId || "",
    displayOrder: feature?.displayOrder || 0,
    active: feature?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (feature) {
        await TaxonomyModel.updateFeature(feature.featureId, form);
      } else {
        await TaxonomyModel.createFeature({ ...form, orgId });
      }
      onSave();
    } catch (e) {
      alert("Failed to save feature: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#242428] rounded-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold">{feature ? "Edit Feature" : "New Feature"}</h3>
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="auth, billing, reports…"
                className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Product</label>
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
              >
                <option value="">None</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Display Order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value || "0") })}
                className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
              />
            </div>
            {feature && (
              <label className="flex items-center gap-2 pt-7">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active
              </label>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================= NEW: Impact Areas ============================= */

function ImpactsTab({ orgId, onUpdate }) {
  const [impacts, setImpacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    load();
  }, [orgId]);

  const load = async () => {
    setLoading(true);
    try {
      const arr = await TaxonomyModel.listImpacts(orgId);
      setImpacts(arr);
      onUpdate?.();
    } finally {
      setLoading(false);
    }
  };

  const delRow = async (id) => {
    if (!confirm("Delete this impact area?")) return;
    await TaxonomyModel.deleteImpact(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Impact Areas</h3>
        <button
          onClick={() => {
            setEditing(null);
            setShow(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Impact
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : impacts.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No impact areas yet.</div>
      ) : (
        <div className="space-y-2">
          {impacts.map((it) => (
            <div
              key={it.impactId}
              className="flex items-center justify-between p-4 bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-xl"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{it.name}</span>
                  {it.active ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Inactive</span>
                  )}
                </div>
                {it.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{it.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(it);
                    setShow(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => delRow(it.impactId)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && (
        <ImpactModal
          orgId={orgId}
          impact={editing}
          onClose={() => {
            setShow(false);
            setEditing(null);
          }}
          onSave={() => {
            setShow(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ImpactModal({ orgId, impact, onClose, onSave }) {
  const [form, setForm] = useState({
    name: impact?.name || "",
    description: impact?.description || "",
    displayOrder: impact?.displayOrder || 0,
    active: impact?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (impact) await TaxonomyModel.updateImpact(impact.impactId, form);
      else await TaxonomyModel.createImpact({ ...form, orgId });
      onSave();
    } catch (e) {
      alert("Failed to save impact area: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#242428] rounded-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold">{impact ? "Edit Impact Area" : "New Impact Area"}</h3>
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Display Order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({ ...form, displayOrder: parseInt(e.target.value || "0") })
                }
                className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
              />
            </div>
            {impact && (
              <label className="flex items-center gap-2 pt-7">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active
              </label>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================= NEW: Root Causes ============================= */

function RootCausesTab({ orgId, onUpdate }) {
  const [rcas, setRcas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    load();
  }, [orgId]);

  const load = async () => {
    setLoading(true);
    try {
      const arr = await TaxonomyModel.listRootCauses(orgId);
      setRcas(arr);
      onUpdate?.();
    } finally {
      setLoading(false);
    }
  };

  const delRow = async (id) => {
    if (!confirm("Delete this root cause type?")) return;
    await TaxonomyModel.deleteRootCause(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Root Cause Types</h3>
        <button
          onClick={() => {
            setEditing(null);
            setShow(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Root Cause
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : rcas.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No root cause types yet.</div>
      ) : (
        <div className="space-y-2">
          {rcas.map((r) => (
            <div
              key={r.rcaId}
              className="flex items-center justify-between p-4 bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-xl"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.name}</span>
                  {r.code && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      {r.code}
                    </span>
                  )}
                  {r.active ? (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Inactive</span>
                  )}
                </div>
                {r.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(r);
                    setShow(true);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => delRow(r.rcaId)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && (
        <RootCauseModal
          orgId={orgId}
          rca={editing}
          onClose={() => {
            setShow(false);
            setEditing(null);
          }}
          onSave={() => {
            setShow(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RootCauseModal({ orgId, rca, onClose, onSave }) {
  const [form, setForm] = useState({
    name: rca?.name || "",
    description: rca?.description || "",
    code: rca?.code || "",
    displayOrder: rca?.displayOrder || 0,
    active: rca?.active !== false,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (rca) await TaxonomyModel.updateRootCause(rca.rcaId, form);
      else await TaxonomyModel.createRootCause({ ...form, orgId });
      onSave();
    } catch (e) {
      alert("Failed to save root cause: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#242428] rounded-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold">{rca ? "Edit Root Cause" : "New Root Cause"}</h3>
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="incident, config, process, infra…"
                className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Display Order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({ ...form, displayOrder: parseInt(e.target.value || "0") })
                }
                className="w-full px-3 py-2 border-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1E] border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
          {rca && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
          )}
          <div className="flex gap-3 pt-2">
            <button className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}