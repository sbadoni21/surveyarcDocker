// models/contactPhonesModel.js
const BASE = "/api/post-gres-apis/contact-phones";
const json = async (res) => (res.ok ? res.json() : Promise.reject(await res.text()));

const toCamel = (p) => ({
  id: p.id,
  contactId: p.contact_id,
  countryCode: p.country_code,
  phoneNumber: p.phone_number,
  isPrimary: p.is_primary,
  isWhatsapp: p.is_whatsapp,
  isVerified: p.is_verified,
  createdAt: p.created_at,
});

const ContactPhonesModel = {

  async add(phone) {
    const body = {
      id: phone.id,
      contact_id: phone.contactId,
      country_code: phone.countryCode,
      phone_number: phone.phoneNumber,
      is_primary: phone.isPrimary ?? false,
      is_whatsapp: phone.isWhatsapp ?? false,
      is_verified: phone.isVerified ?? false,
    };

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

export default ContactPhonesModel;
