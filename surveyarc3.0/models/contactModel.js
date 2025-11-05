// models/contactModel.js
const BASE = "/api/post-gres-apis/contacts";
const json = async (res) =>
  res.ok ? res.json() : Promise.reject(await res.text());

//
// ---- Serializer -> camelCase
//
const toCamel = (c) => ({
  contactId: c.contact_id,
  orgId: c.org_id,
  userId: c.user_id,
  name: c.name,
  contactType: c.contact_type,
  primaryIdentifier: c.primary_identifier,
  status: c.status,
  meta: c.meta ?? {},
  createdAt: c.created_at,
  updatedAt: c.updated_at,
  deletedAt: c.deleted_at,
  emails: c.emails || [],
  phones: c.phones || [],
  socials: c.socials || [],
  lists: c.lists || [],
});

//
// ---- Helpers
//
const detectIdentifier = (obj) => {
  // priority: email → phone → social
  if (obj.email) {
    return {
      primaryIdentifier: obj.email.toLowerCase(),
      contactType: "email",
    };
  }

  if (obj.phone) {
    return {
      primaryIdentifier: obj.phone.replace(/\s+/g, ""),
      contactType: "phone",
    };
  }

  if (obj.platform && obj.handle) {
    return {
      primaryIdentifier: `${obj.platform}:${obj.handle}`,
      contactType: "social",
    };
  }

  return {
    primaryIdentifier: null,
    contactType: "other",
  };
};

//
// ---- Contact API
//
const ContactModel = {
  /* LIST */
  async getAll(orgId) {
    const res = await fetch(`${BASE}?org_id=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
    });
    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  /* GET */
  async get(contactId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      cache: "no-store",
    });
    return toCamel(await json(res));
  },

  /* CREATE */
  async create(contact) {
    // Auto-detect primaryIdentifier + type if not provided
    let primaryIdentifier = contact.primaryIdentifier ?? null;
    let contactType = contact.contactType ?? null;

    if (!primaryIdentifier) {
      const info = detectIdentifier(contact);
      primaryIdentifier = info.primaryIdentifier;
      contactType = info.contactType;
    }

    // ✅ FIX: Build emails array
    const emails = [];
    if (contact.email) {
      emails.push({
        email: contact.email,
        is_primary: true,
        is_verified: contact.emailVerified || false,
        status: "active",
      });
    }
    // Include any additional emails from contact.emails array
    if (contact.emails && Array.isArray(contact.emails)) {
      emails.push(...contact.emails.map(e => ({
        email: e.email,
        is_primary: e.isPrimary || false,
        is_verified: e.isVerified || false,
        status: e.status || "active",
      })));
    }

    // ✅ FIX: Build phones array
    const phones = [];
    if (contact.phone) {
      phones.push({
        country_code: contact.countryCode || "",
        phone_number: contact.phone,
        is_primary: true,
        is_whatsapp: contact.isWhatsapp || false,
        is_verified: contact.phoneVerified || false,
      });
    }
    // Include any additional phones from contact.phones array
    if (contact.phones && Array.isArray(contact.phones)) {
      phones.push(...contact.phones.map(p => ({
        country_code: p.countryCode || "",
        phone_number: p.phoneNumber,
        is_primary: p.isPrimary || false,
        is_whatsapp: p.isWhatsapp || false,
        is_verified: p.isVerified || false,
      })));
    }

    // ✅ FIX: Build socials array
    const socials = [];
    if (contact.platform && contact.handle) {
      socials.push({
        platform: contact.platform,
        handle: contact.handle,
        link: contact.link || null,
      });
    }
    // Include any additional socials from contact.socials array
    if (contact.socials && Array.isArray(contact.socials)) {
      socials.push(...contact.socials.map(s => ({
        platform: s.platform,
        handle: s.handle,
        link: s.link || null,
      })));
    }

    const body = {
      contact_id: contact.contactId,
      org_id: contact.orgId,
      user_id: contact.userId,
      name: contact.name ?? "",
      contact_type: contactType ?? "other",
      primary_identifier: primaryIdentifier ?? null,
      status: contact.status ?? "active",
      meta: contact.meta ?? {},
      // ✅ ADD THESE!
      emails: emails.length > 0 ? emails : [],
      phones: phones.length > 0 ? phones : [],
      socials: socials.length > 0 ? socials : [],
    };

    console.log("Creating contact with body:", body);

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  /* UPDATE */
  async update(contactId, update = {}) {
    const body = {};

    if (update.name !== undefined) body.name = update.name;
    if (update.status !== undefined) body.status = update.status;
    if (update.userId !== undefined) body.user_id = update.userId;
    if (update.meta !== undefined) body.meta = update.meta;

    // Auto-detect if new identifiers are provided
    if (update.email || update.phone || (update.platform && update.handle)) {
      const { primaryIdentifier, contactType } = detectIdentifier(update);
      if (primaryIdentifier) body.primary_identifier = primaryIdentifier;
      if (contactType) body.contact_type = contactType;
    }

    // Manual override
    if (update.primaryIdentifier !== undefined) {
      body.primary_identifier = update.primaryIdentifier;
    }
    if (update.contactType !== undefined) {
      body.contact_type = update.contactType;
    }

    // ✅ ADD: Support for updating nested arrays
    if (update.emails !== undefined) {
      body.emails = update.emails.map(e => ({
        email: e.email,
        is_primary: e.isPrimary || false,
        is_verified: e.isVerified || false,
        status: e.status || "active",
      }));
    }

    if (update.phones !== undefined) {
      body.phones = update.phones.map(p => ({
        country_code: p.countryCode || "",
        phone_number: p.phoneNumber,
        is_primary: p.isPrimary || false,
        is_whatsapp: p.isWhatsapp || false,
        is_verified: p.isVerified || false,
      }));
    }

    if (update.socials !== undefined) {
      body.socials = update.socials.map(s => ({
        platform: s.platform,
        handle: s.handle,
        link: s.link || null,
      }));
    }

    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  /* DELETE */
  async delete(contactId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },
};

export default ContactModel;