// models/postGresModels/tagModel.js
const BASE = "/api/post-gres-apis/tags";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const omitNullish = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
};

const toCamel = (t) => ({
  tagId: t.tag_id,
  orgId: t.org_id,
  name: t.name,
  color: t.color,
  description: t.description,
  category: t.category,
  usageCount: t.usage_count,
  meta: t.meta || {},
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

const TagModel = {
  async list({ orgId, category, search, limit = 100, offset = 0 } = {}) {
    const qs = new URLSearchParams();
    if (orgId) qs.set("org_id", orgId);
    if (category) qs.set("category", category);
    if (search) qs.set("search", search);
    if (limit != null) qs.set("limit", String(limit));
    if (offset != null) qs.set("offset", String(offset));
    
    const res = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  async get(tagId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(tagId)}`, { cache: "no-store" });
    const t = await json(res);
    return toCamel(t);
  },

  async create(data) {
    const payloadRaw = {
      tag_id: data.tagId || null,
      org_id: data.orgId,
      name: data.name,
      color: data.color || null,
      description: data.description || null,
      category: data.category || null,
    };
    
    const payload = omitNullish(payloadRaw);
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },

  async update(tagId, patch) {
    const map = (p) => {
      const out = { ...p };
      if ("orgId" in out) { out.org_id = out.orgId; delete out.orgId; }
      if ("tagId" in out) { out.tag_id = out.tagId; delete out.tagId; }
      if ("usageCount" in out) { out.usage_count = out.usageCount; delete out.usageCount; }
      return omitNullish(out);
    };

    const res = await fetch(`${BASE}/${encodeURIComponent(tagId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(map(patch)),
      cache: "no-store",
    });
    const t = await json(res);
    return toCamel(t);
  },

  async remove(tagId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(tagId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (res.status === 204) return true;
    await json(res);
    return true;
  },

  async getCategories(orgId) {
  const qs = new URLSearchParams({ org_id: orgId });
  const res = await fetch(`${BASE}/categories?${qs.toString()}`, { cache: "no-store" });
  const data = await json(res);
  // Normalize to array of strings
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.categories)) return data.categories;
  return [];
},
  async count({ orgId, category } = {}) {
    const qs = new URLSearchParams();
    if (orgId) qs.set("org_id", orgId);
    if (category) qs.set("category", category);
    const res = await fetch(`${BASE}/count?${qs.toString()}`, { cache: "no-store" });
    return json(res);
  },
};

export default TagModel;
