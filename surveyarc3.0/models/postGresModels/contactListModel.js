const BASE = "/api/post-gres-apis/contacts";
const json = async (res) => (res.ok ? res.json() : Promise.reject(await res.text()));

const toCamel = (c) => ({
  contactId: c.contact_id,
  orgId: c.org_id,
  userId: c.user_id,
  name: c.name,
  email: c.email,
  emailLower: c.email_lower,
  status: c.status,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
  meta: c.meta || {},
});

const ContactModel = {
  async getAll(orgId) {
    const res = await fetch(`${BASE}?org_id=${encodeURIComponent(orgId)}`, { cache: "no-store" });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },
  async create(orgId, contact) {
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        contact_id: contact.contactId,           // optional
        name: contact.name,
        email: contact.email,
        email_lower: contact.emailLower || contact.email?.toLowerCase(),
        user_id: contact.userId,
        status: contact.status || "active",
        meta: contact.meta || {},
      }),
      cache: "no-store",
    });
    return toCamel(await json(res));
  },
  async update(contactId, update) {
    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
      cache: "no-store",
    });
    return toCamel(await json(res));
  },
  async delete(contactId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, { method: "DELETE", cache: "no-store" });
    return json(res);
  },
};
export default ContactModel;
