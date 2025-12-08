// models/postGresModels/salesforceContactModel.js
const BASE = "/api/post-gres-apis/salesforce/contacts";
const BASE2 = "/api/post-gres-apis/salesforce/";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

// Normalize backend fields into camelCase shape
const toCamel = (c) => {
  if (!c) return null;

  // When coming from list endpoint: { id, firstName, lastName, email, accountName, raw }
  // Or raw Salesforce fields if you bypass schema
  const accountName =
    c.accountName ||
    c.account_name ||
    (c.Account && (c.Account.Name || c.Account.name));

  return {
    contactId: c.id || c.Id,
    firstName: c.firstName ?? c.FirstName ?? null,
    lastName: c.lastName ?? c.LastName ?? null,
    email: c.email ?? c.Email ?? null,
    accountName: accountName || null,
    raw: c.raw || c, // keep everything just in case
  };
};

const SalesforceContactModel = {
  /**
   * List contacts from FastAPI Salesforce integration
   * GET /salesforce/contacts?limit=&use_apex=
   */
  async list({ limit = 50, useApex = true } = {}) {
    const qs = new URLSearchParams();
    if (limit != null) qs.set("limit", String(limit));
    if (useApex != null) qs.set("use_apex", String(useApex));

    const res = await fetch(`${BASE}?${qs.toString()}`, { cache: "no-store" });
    const data = await json(res);

    // Expecting { total, items } from FastAPI
    const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
    const mapped = items.map(toCamel);

    return {
      total: data.total ?? mapped.length,
      items: mapped,
    };
  },

  /**
   * Get a single contact by id
   * GET /salesforce/contacts/{contact_id}
   */
  async get(contactId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      cache: "no-store",
    });
    const c = await json(res);
    return toCamel(c);
  },

  /**
   * Update a contact in Salesforce via backend
   * PATCH /salesforce/contacts/{contact_id}
   * patch: { firstName?, lastName?, email?, ... }
   */
  async update(contactId, patch) {
    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    const c = await json(res);
    return toCamel(c);
  },
async contactsByAccount(accountId) {
  console.log("[SalesforceContactModel] contactsByAccount -> accountId:", accountId);

  // NOTE: BASE2 already ends with /salesforce/
  const res = await fetch(`${BASE2}accounts/${accountId}/contacts`, {
    cache: "no-store",
  });

  const data = await json(res);
  console.log("[SalesforceContactModel] RAW data from Next API:", data);

  // Support all possible shapes:
  // 1) { contacts: [...] }
  // 2) { items: [...] }
  // 3) [ ... ]
  let items = [];

  if (Array.isArray(data?.contacts)) {
    items = data.contacts;
  } else if (Array.isArray(data?.items)) {
    items = data.items;
  } else if (Array.isArray(data)) {
    items = data;
  }

  console.log("[SalesforceContactModel] Normalized items:", items);

  return items.map(toCamel);
},



  /**
   * Delete a contact in Salesforce via backend
   * DELETE /salesforce/contacts/{contact_id}
   */
  async remove(contactId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      method: "DELETE",
      cache: "no-store",
    });

    if (res.status === 204) return true;
    await json(res);
    return true;
  },
};

export default SalesforceContactModel;
