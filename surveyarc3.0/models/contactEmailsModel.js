// models/contactEmailsModel.js
const BASE = "/api/post-gres-apis/contact-emails";
const json = async (res) => (res.ok ? res.json() : Promise.reject(await res.text()));

const toCamel = (e) => ({
  id: e.id,
  contactId: e.contact_id,
  email: e.email,
  emailLower: e.email_lower,
  isPrimary: e.is_primary,
  isVerified: e.is_verified,
  createdAt: e.created_at,
  status: e.status,
});

const ContactEmailsModel = {

  async add(email) {
    const body = {
      id: email.id,
      contact_id: email.contactId,
      email: email.email,
      email_lower: email.emailLower ?? email.email?.toLowerCase(),
      is_primary: email.isPrimary ?? false,
      is_verified: email.isVerified ?? false,
      status: email.status ?? "active",
    };
console.log(body)
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  async delete(id) {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },
};

export default ContactEmailsModel;
