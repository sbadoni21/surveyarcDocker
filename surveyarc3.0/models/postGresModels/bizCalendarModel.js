// models/postGresModels/bizCalendarModel.js
const BASE = "/api/post-gres-apis/business-calendars";
import { auth } from "@/firebase/firebase";

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken(false);
  return {
    Authorization: `Bearer ${token}`,
    "x-user-id": user.uid,
  };
}

async function safeJson(res) {
  if (!res.ok) {
    let body;
    try { body = await res.json(); }
    catch {
      try { body = await res.text(); }
      catch { body = ""; }
    }
    const msg = typeof body === "string" ? body : (body?.detail || JSON.stringify(body));
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

const BizCalendarModel = {
  async list({ orgId, active } = {}) {
    const params = new URLSearchParams();
    if (orgId) params.set("org_id", orgId);
    if (active !== undefined) params.set("active", String(active));

    const headers = await authHeaders();
    const res = await fetch(`${BASE}?${params.toString()}`, {
      cache: "no-store",
      headers,
    });
    return safeJson(res);
  },

  async get(calendarId) {
    const headers = await authHeaders();
    const res = await fetch(`${BASE}/${calendarId}`, {
      cache: "no-store",
      headers,
    });
    return safeJson(res);
  },

  async create(payload) {
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    };
    const res = await fetch(BASE, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async update(calendarId, patch) {
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    };
    const res = await fetch(`${BASE}/${calendarId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async remove(calendarId) {
    const headers = await authHeaders();
    const res = await fetch(`${BASE}/${calendarId}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
    if (res.status === 204) return true;
    // If backend returns JSON error, surface it
    return safeJson(res);
  },

  // ---- Hours & Holidays ----
  async setHours(calendarId, hoursPayload) {
    // hoursPayload: [{ weekday:0, start_min:540, end_min:1080 }, ...]
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    };
    const res = await fetch(`${BASE}/${calendarId}/hours`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ hours: hoursPayload }),
      cache: "no-store",
    });
    return safeJson(res);
  },

  async setHolidays(calendarId, holidaysPayload) {
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    };
    const res = await fetch(`${BASE}/${calendarId}/holidays`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ holidays: holidaysPayload }),
      cache: "no-store",
    });
    return safeJson(res);
  },
};

export default BizCalendarModel;
