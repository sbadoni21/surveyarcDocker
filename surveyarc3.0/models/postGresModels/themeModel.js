// models/postGresModels/themeModel.js
const BASE = "/api/post-gres-apis/themes";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (t) => ({
  themeId: t.theme_id,
  orgId: t.org_id,
  name: t.name,

  lightPrimaryColor: t.light_primary_color,
  lightSecondaryColor: t.light_secondary_color,
  lightTextColor: t.light_text_color,
  lightBackgroundColor: t.light_background_color,

  darkPrimaryColor: t.dark_primary_color,
  darkSecondaryColor: t.dark_secondary_color,
  darkTextColor: t.dark_text_color,
  darkBackgroundColor: t.dark_background_color,

  logoUrl: t.logo_url,
  meta: t.meta || {},
  isActive: t.is_active,

  createdBy: t.created_by,
});

const toSnake = (t) => ({
  org_id: t.orgId,
  name: t.name,

  light_primary_color: t.lightPrimaryColor,
  light_secondary_color: t.lightSecondaryColor,
  light_text_color: t.lightTextColor,
  light_background_color: t.lightBackgroundColor,

  dark_primary_color: t.darkPrimaryColor,
  dark_secondary_color: t.darkSecondaryColor,
  dark_text_color: t.darkTextColor,
  dark_background_color: t.darkBackgroundColor,
  created_by:t.userId,

  logo_url: t.logoUrl,
  meta: t.meta,
  is_active: t.isActive,
});

const ThemeModel = {
  /** CREATE */
  async create(data) {
    console.log(data);
    const body = toSnake(data);
    console.log(body);

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": data.userId,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  /** LIST */
  async getAllByOrg(orgId, userId) {
    const res = await fetch(
      `${BASE}?org_id=${encodeURIComponent(orgId)}&user_id=${encodeURIComponent(
        userId
      )}`,
      {
        cache: "no-store",
      }
    );

    const arr = await json(res);
    return (arr || []).map(toCamel);
  },

  /** GET BY ID */
  async get(themeId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(themeId)}`, {
      cache: "no-store",
    });
    return toCamel(await json(res));
  },

  /** UPDATE */
  async update(themeId, data) {
    const body = toSnake(data);

    const res = await fetch(`${BASE}/${encodeURIComponent(themeId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  /** DELETE */
  async deleteTheme(themeId, orgId, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(themeId)}?org_id=${encodeURIComponent(
        orgId
      )}&user_id=${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        cache: "no-store",
      }
    );

    return json(res);
  },
  async duplicate(themeId, userId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(themeId)}/duplicate?user_id=${encodeURIComponent(userId)}`,
      {
        method: "POST",
        cache: "no-store",
      }
    );
    return toCamel(await json(res));
  },
  /** DEACTIVATE */
  async deactivate(themeId) {
    return this.update(themeId, { isActive: false });
  },

  /** ACTIVATE */
  async activate(themeId) {
    return this.update(themeId, { isActive: true });
  },
};

export default ThemeModel;
