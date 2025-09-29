// ============================================
// FRONTEND MODEL - models/postGresModels/ticketCategoryModel.js
// ============================================

const BASE = "/api/post-gres-apis/ticket-categories";
const json = async (r) => (r.ok ? r.json() : Promise.reject(await r.text()));

// Helper functions for data conversion
const omitNullish = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
};

const get = (obj, camel, snake) =>
  obj?.[camel] ?? obj?.[snake] ?? undefined;

export const toApiFormat = (data = {}) => {
  return omitNullish({
    // Category fields
    category_id: get(data, "categoryId", "category_id"),
    subcategory_id: get(data, "subcategoryId", "subcategory_id"),
    product_id: get(data, "productId", "product_id"),
    org_id: get(data, "orgId", "org_id"),
    name: get(data, "name", "name"),
    description: get(data, "description", "description"),
    icon: get(data, "icon", "icon"),
    color: get(data, "color", "color"),
    code: get(data, "code", "code"),
    version: get(data, "version", "version"),
    platform: get(data, "platform", "platform"),
    display_order: get(data, "displayOrder", "display_order"),
    active: get(data, "active", "active"),
    default_priority: get(data, "defaultPriority", "default_priority"),
    default_severity: get(data, "defaultSeverity", "default_severity"),
    default_sla_id: get(data, "defaultSlaId", "default_sla_id"),
    meta: get(data, "meta", "meta"),
  });
};

export const fromApiFormat = (row = {}) => ({
  categoryId: get(row, "categoryId", "category_id"),
  subcategoryId: get(row, "subcategoryId", "subcategory_id"),
  productId: get(row, "productId", "product_id"),
  orgId: get(row, "orgId", "org_id"),
  name: get(row, "name", "name"),
  description: get(row, "description", "description"),
  icon: get(row, "icon", "icon"),
  color: get(row, "color", "color"),
  code: get(row, "code", "code"),
  version: get(row, "version", "version"),
  platform: get(row, "platform", "platform"),
  displayOrder: get(row, "displayOrder", "display_order"),
  active: get(row, "active", "active"),
  subcategoryCount: get(row, "subcategoryCount", "subcategory_count"),
  defaultPriority: get(row, "defaultPriority", "default_priority"),
  defaultSeverity: get(row, "defaultSeverity", "default_severity"),
  defaultSlaId: get(row, "defaultSlaId", "default_sla_id"),
  meta: get(row, "meta", "meta") || {},
  createdAt: get(row, "createdAt", "created_at"),
  updatedAt: get(row, "updatedAt", "updated_at"),
});

const TicketCategoryModel = {
  // ============ Categories ============
  async listCategories(orgId, includeInactive = false) {
    if (!orgId) throw new Error("Organization ID is required");
    const qs = new URLSearchParams({ org_id: orgId });
    if (includeInactive) qs.set("include_inactive", "true");
    
    const r = await fetch(`${BASE}/categories?${qs}`, { cache: "no-store" });
    const arr = await json(r);
    return Array.isArray(arr) ? arr.map(fromApiFormat) : [];
  },

  async getCategory(categoryId, includeSubcategories = true) {
    if (!categoryId) throw new Error("Category ID is required");
    
    const qs = new URLSearchParams();
    if (includeSubcategories) qs.set("include_subcategories", "true");
    
    const r = await fetch(
      `${BASE}/categories/${encodeURIComponent(categoryId)}?${qs}`,
      { cache: "no-store" }
    );
    const data = await json(r);
    return fromApiFormat(data);
  },

  async createCategory(body) {
    console.log(body)
    if (!body.name || !body.orgId) {
      throw new Error("Name and orgId are required");
    }
    
    const payload = toApiFormat(body);
    const r = await fetch(`${BASE}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return fromApiFormat(await json(r));
  },

  async updateCategory(categoryId, patch) {
    if (!categoryId) throw new Error("Category ID is required");
    
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/categories/${encodeURIComponent(categoryId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return fromApiFormat(await json(r));
  },

  async deleteCategory(categoryId) {
    if (!categoryId) throw new Error("Category ID is required");
    
    const r = await fetch(`${BASE}/categories/${encodeURIComponent(categoryId)}`, {
      method: "DELETE",
    });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Subcategories ============
  async listSubcategories({ orgId, categoryId, includeInactive = false } = {}) {
    if (!orgId && !categoryId) {
      throw new Error("Either orgId or categoryId is required");
    }
    
    const qs = new URLSearchParams();
    if (orgId) qs.set("org_id", orgId);
    if (categoryId) qs.set("category_id", categoryId);
    if (includeInactive) qs.set("include_inactive", "true");
    
    const r = await fetch(`${BASE}/subcategories?${qs}`, { cache: "no-store" });
    const arr = await json(r);
    return Array.isArray(arr) ? arr.map(fromApiFormat) : [];
  },

  async getSubcategory(subcategoryId) {
    if (!subcategoryId) throw new Error("Subcategory ID is required");
    
    const r = await fetch(
      `${BASE}/subcategories/${encodeURIComponent(subcategoryId)}`,
      { cache: "no-store" }
    );
    return fromApiFormat(await json(r));
  },

  async createSubcategory(body) {
    if (!body.name || !body.categoryId || !body.orgId) {
      throw new Error("Name, categoryId, and orgId are required");
    }
    
    const payload = toApiFormat(body);
    const r = await fetch(`${BASE}/subcategories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return fromApiFormat(await json(r));
  },

  async updateSubcategory(subcategoryId, patch) {
    if (!subcategoryId) throw new Error("Subcategory ID is required");
    
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/subcategories/${encodeURIComponent(subcategoryId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return fromApiFormat(await json(r));
  },

  async deleteSubcategory(subcategoryId) {
    if (!subcategoryId) throw new Error("Subcategory ID is required");
    
    const r = await fetch(`${BASE}/subcategories/${encodeURIComponent(subcategoryId)}`, {
      method: "DELETE",
    });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Products ============
  async listProducts(orgId, { platform, includeInactive = false } = {}) {
    if (!orgId) throw new Error("Organization ID is required");
    
    const qs = new URLSearchParams({ org_id: orgId });
    if (platform) qs.set("platform", platform);
    if (includeInactive) qs.set("include_inactive", "true");
    
    const r = await fetch(`${BASE}/products?${qs}`, { cache: "no-store" });
    const arr = await json(r);
    return Array.isArray(arr) ? arr.map(fromApiFormat) : [];
  },

  async getProduct(productId) {
    if (!productId) throw new Error("Product ID is required");
    
    const r = await fetch(
      `${BASE}/products/${encodeURIComponent(productId)}`,
      { cache: "no-store" }
    );
    return fromApiFormat(await json(r));
  },

  async createProduct(body) {
    if (!body.name || !body.code || !body.orgId) {
      throw new Error("Name, code, and orgId are required");
    }
    
    const payload = toApiFormat(body);
    const r = await fetch(`${BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return fromApiFormat(await json(r));
  },

  async updateProduct(productId, patch) {
    if (!productId) throw new Error("Product ID is required");
    
    const payload = toApiFormat(patch);
    const r = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return fromApiFormat(await json(r));
  },

  async deleteProduct(productId) {
    if (!productId) throw new Error("Product ID is required");
    
    const r = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`, {
      method: "DELETE",
    });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return true;
  },

  // ============ Utility Methods ============
  async getCategoryWithSubcategories(categoryId) {
    return this.getCategory(categoryId, true);
  },

  async searchCategories(query, orgId) {
    const categories = await this.listCategories(orgId);
    if (!query) return categories;
    
    const searchTerm = query.toLowerCase();
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(searchTerm) ||
      (cat.description && cat.description.toLowerCase().includes(searchTerm))
    );
  },
};

export default TicketCategoryModel;
