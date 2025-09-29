// components/admin/CategoryManagement.jsx
"use client";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight } from "lucide-react";
import TicketCategoryModel from "@/models/postGresModels/ticketCategoryModel";
import { usePathname } from "next/navigation";

export default function CategoryManagement() {
  const path = usePathname();
  const orgId = path.split('/')[3];
  console.log(orgId)
  const [activeTab, setActiveTab] = useState("categories");
  
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("categories")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "categories"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setActiveTab("subcategories")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "subcategories"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Subcategories
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "products"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Products
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "categories" && <CategoriesTab orgId={orgId} />}
          {activeTab === "subcategories" && <SubcategoriesTab orgId={orgId} />}
          {activeTab === "products" && <ProductsTab orgId={orgId} />}
        </div>
      </div>
    </div>
  );
}

// Categories Tab Component
function CategoriesTab({orgId}) {
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
    } catch (error) {
      console.error("Failed to load categories:", error);
      alert("Failed to load categories: " + error.message);
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
    return <div className="text-center py-8">Loading categories...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Categories</h2>
        <button
          onClick={() => {
            setEditingCategory(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      <div className="space-y-2">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No categories yet. Add your first category to get started.
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.categoryId} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleExpand(category.categoryId)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {expandedCategories.has(category.categoryId) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  
                  {category.icon && (
                    <span 
                      className="text-2xl"
                      style={{ color: category.color || '#000' }}
                    >
                      {category.icon}
                    </span>
                  )}
                  
                  <div className="flex-1">
                    <h3 className="font-semibold">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-500">{category.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {category.subcategoryCount || 0} subcategories
                    </p>
                  </div>

                  {!category.active && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(category);
                      setShowModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.categoryId)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expandedCategories.has(category.categoryId) && (
                <div className="bg-gray-50 p-4 border-t border-gray-200">
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
    icon: category?.icon || "",
    color: category?.color || "#3b82f6",
    displayOrder: category?.displayOrder || 0,
    active: category?.active !== false,
    orgId: orgId
  });
  const [saving, setSaving] = useState(false);
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    console.log(form)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-semibold mb-4">
          {category ? "Edit Category" : "New Category"}
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
                Icon (emoji)
              </label>
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="🐛"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
              />
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

          {category && (
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

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (subcategories.length === 0) {
    return <div className="text-sm text-gray-500">No subcategories yet</div>;
  }

  return (
    <div className="space-y-2">
      {subcategories.map((sub) => (
        <div key={sub.subcategoryId} className="flex items-center justify-between p-2 bg-white rounded">
          <div className="flex-1">
            <span className="text-sm font-medium">{sub.name}</span>
            {sub.description && (
              <p className="text-xs text-gray-500">{sub.description}</p>
            )}
          </div>
          {!sub.active && (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
              Inactive
            </span>
          )}
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
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
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