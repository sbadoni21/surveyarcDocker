// models/postGresModels/quotaModel.js
const BASE = "/api/post-gres-apis/quotaApi";

const toJson = async (res) => {
  const txt = await res.text();
  let data = {};
  try {
    data = txt ? JSON.parse(txt) : {};
  } catch {}
  if (!res.ok) {
    const msg =
      typeof data === "object" && data?.detail
        ? JSON.stringify(data.detail)
        : txt;
    throw new Error(
      `${res.status} ${res.statusText} :: ${msg || "Request failed"}`
    );
  }
  return data;
};

const snakeToCamel = (obj) => {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        return [ck, snakeToCamel(v)];
      })
    );
  }
  return obj;
};

const camelToSnake = (obj) => {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        const sk = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
        return [sk, camelToSnake(v)];
      })
    );
  }
  return obj;
};

const quotaModel = {
  // CREATE
  async create(payload) {
    console.log("Received payload in quotaModel.create", payload);
    const body = JSON.stringify(camelToSnake(payload || {}));
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return snakeToCamel(await toJson(res));
  },

  // LIST QUOTAS FOR SURVEY
  async listBySurvey(surveyId) {
    const url = new URL(`${BASE}/by-survey/${surveyId}`, window.location.origin);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await toJson(res);
    return Array.isArray(data) ? data.map(snakeToCamel) : [];
  },

  // UPDATE
  async update(quotaId, payload) {
    const url = new URL(`${BASE}/${quotaId}`, window.location.origin);
    const body = JSON.stringify(camelToSnake(payload || {}));
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await toJson(res);
    return snakeToCamel(data);
  },

  // DELETE
  async delete(quotaId) {
    const url = new URL(`${BASE}/${quotaId}`, window.location.origin);
    const res = await fetch(url.toString(), { method: "DELETE" });
    const data = await toJson(res);
    return data;
  },

  // EVALUATE QUOTA
  async evaluate(quotaId, payload) {
    const body = JSON.stringify(camelToSnake(payload || {}));
    const res = await fetch(`${BASE}/${quotaId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body,
    });

    return snakeToCamel(await toJson(res));
  },

  // INCREMENT QUOTA
  async increment(quotaId, payload) {
    const body = JSON.stringify(camelToSnake(payload || {}));
    const res = await fetch(`${BASE}/${quotaId}/increment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body,
    });

    return snakeToCamel(await toJson(res));
  },
};

export default quotaModel;
