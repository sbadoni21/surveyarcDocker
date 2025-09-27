// models/postGresModels/bizCalendarModel.js
const BASE = "/api/post-gres-apis/business-calendars"; // create a small proxy to biz_calendars (optional separate router)

const safeJson = async (res) => {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
};

const BizCalendarModel = {
  async list({ orgId, active = true } = {}) {
    const params = new URLSearchParams({ org_id: orgId });
    if (active !== undefined) params.set("active", String(active));
    const res = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
    return safeJson(res);
  },

  async get(calendarId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(calendarId)}`, { cache: "no-store" });
    return safeJson(res);
  },

  async create(payload) {
    console.log(payload)
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return safeJson(res);
  },

  async update(calendarId, patch) {
    const res = await fetch(`${BASE}/${encodeURIComponent(calendarId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return safeJson(res);
  },

  async remove(calendarId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(calendarId)}`, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return true;
  },

  // hours & holidays (you can wire to your biz_calendar_hours / biz_calendar_holidays routes)
  async setHours(calendarId, hoursPayload) {
    // hoursPayload: [{weekday:0,start_min:540,end_min:1080}, ...]
    const res = await fetch(`${BASE}/${encodeURIComponent(calendarId)}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: hoursPayload }),
    });
    return safeJson(res);
  },

  async setHolidays(calendarId, holidaysPayload) {
    // holidaysPayload: [{date_iso:"2025-12-25", name:"Christmas"}, ...]
    const res = await fetch(`${BASE}/${encodeURIComponent(calendarId)}/holidays`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holidays: holidaysPayload }),
    });
    return safeJson(res);
  },
};

export default BizCalendarModel;
