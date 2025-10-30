const BASE = "/api/post-gres-apis/contact-socials";
const json = async (res) => (res.ok ? res.json() : Promise.reject(await res.text()));

const toCamel = (s) => ({
  id: s.id,
  contactId: s.contact_id,
  platform: s.platform,
  handle: s.handle,
  link: s.link,
  createdAt: s.created_at,
});

const ContactSocialsModel = {

  async add(social) {
    const body = {
      id: social.id,
      contact_id: social.contactId,
      platform: social.platform,
      handle: social.handle,
      link: social.link,
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

export default ContactSocialsModel;
