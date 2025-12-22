// models/listModel.js
const BASE = "/api/post-gres-apis/contact-lists";
const json = async (res) => (res.ok ? res.json() : Promise.reject(await res.text()));

// Helper to convert contact from snake_case to camelCase
const contactToCamel = (c) => ({
  contactId: c.contact_id,
  orgId: c.org_id,
  userId: c.user_id,
  name: c.name,
  primaryIdentifier: c.primary_identifier,
  contactType: c.contact_type,
  status: c.status,
  meta_data: c.meta_data,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
  deletedAt: c.deleted_at,
  emails: c.emails || [],
  phones: c.phones || [],
  socials: c.socials || [],
});

const toCamel = (l) => ({
  listId: l.list_id,
  orgId: l.org_id,
  listName: l.list_name,
    meta_data: l.meta_data,

  status: l.status,
  createdAt: l.created_at,
  updatedAt: l.updated_at,
  deletedAt: l.deleted_at,
  contacts: (l.contacts || []).map(contactToCamel), // ✅ Add this line
});

const ListModel = {
  async getAll(orgId) {
    const res = await fetch(`${BASE}?org_id=${encodeURIComponent(orgId)}`);
    const arr = await json(res);
    return arr.map(toCamel);
  },

  async create(list) {
   const body = {
    list_id: list.listId,
    org_id: list.orgId,
    list_name: list.listName,
    status: list.status ?? "live",
    contact_ids: list.contactIds || [], // ✅ Add this line
  };

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  async update(listId, update = {}) {
    const body = {};
    if (update.listName !== undefined) body.list_name = update.listName;
    if (update.status !== undefined) body.status = update.status;

    const res = await fetch(`${BASE}/${encodeURIComponent(listId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },
async addContacts(listId, contactIds) {
  const res = await fetch(`${BASE}/${listId}/contacts`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contact_ids: contactIds }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || error.message || "Failed to add contacts to list");
  }

  const data = await res.json();

  // Case 1: API returns the updated list object directly
  if (data.list_id) {
    return toCamel(data);         // ✅ now camelCase
  }

  // Case 2: API wraps it as { list: {...}, ... }
  if (data.list && data.list.list_id) {
    return {
      ...data,
      list: toCamel(data.list),   // ✅ keep meta, convert inner list
    };
  }

  // Case 3: API just returns { success: true } or summary
  return data; // but then don't use this to replace your list in state
}
,

  /**
   * Remove contacts from a list
   */
async removeContacts(listId, contactIds) {
  const res = await fetch(`${BASE}/${listId}/contacts`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contact_ids: contactIds }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || error.message || "Failed to remove contacts from list");
  }

  const data = await res.json();

  if (data.list_id) return toCamel(data);
  if (data.list && data.list.list_id) {
    return { ...data, list: toCamel(data.list) };
  }

  return data;
},


  /**
   * Get contacts available to add to a list (not already in it)
   */
   async getAvailableContacts(listId, orgId) {
    const response = await fetch(
      `${BASE}/${listId}/available-contacts?org_id=${orgId}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch available contacts");
    }

    return response.json();
  },

  async delete(listId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(listId)}`, {
      method: "DELETE",
      cache: "no-store",
    });

    return json(res);
  },
};

export default ListModel;