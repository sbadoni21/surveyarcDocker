// models/postGresModels/participantSourceModel.js
const BASE = "/api/post-gres-apis/participant-sources";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const ParticipantSourceModel = {
  /**
   * Create a new participant source (panel)
   * POST /participant-sources
   */
  async create(payload) {
    // payload should match ParticipantSourceCreate:
    // {
    //   org_id, survey_id, source_name, source_type, description,
    //   is_active, expected_completes, expected_incidence_rate,
    //   url_variables, exit_pages, meta_data
    // }
    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Get a single participant source
   * GET /participant-sources/{source_id}
   */
  async get(sourceId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(sourceId)}`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * List participant sources (optional filters)
   * GET /participant-sources?survey_id=&org_id=&source_type=&is_active=
   */
  async list(filters = {}) {
    const params = new URLSearchParams();
    if (filters.survey_id) params.set("survey_id", filters.survey_id);
    if (filters.org_id) params.set("org_id", filters.org_id);
    if (filters.source_type) params.set("source_type", filters.source_type);
    if (typeof filters.is_active === "boolean") {
      params.set("is_active", String(filters.is_active));
    }
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.offset) params.set("offset", String(filters.offset));

    const qs = params.toString();
    const url = qs ? `${BASE}?${qs}` : BASE;

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    return json(res); // { items: [], total: number }
  },

  /**
   * Update a participant source
   * PUT /participant-sources/{source_id}
   */
  async update(sourceId, updateData) {
    const res = await fetch(`${BASE}/${encodeURIComponent(sourceId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData), // matches ParticipantSourceUpdate
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Delete a participant source
   * DELETE /participant-sources/{source_id}
   */
  async remove(sourceId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(sourceId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Get stats for a participant source
   * GET /participant-sources/{source_id}/stats
   */
  async stats(sourceId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(sourceId)}/stats`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Generate survey URL for a source
   * GET /participant-sources/{source_id}/generate-url?base_url=
   */
  async generateUrl(sourceId, baseUrl) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(sourceId)}/generate-url?base_url=${encodeURIComponent(
        baseUrl
      )}`,
      { method: "GET", cache: "no-store" }
    );
    return json(res);
  },

  /**
   * Tracking endpoints
   */
  async trackClick(sourceId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(sourceId)}/track/click`,
      { method: "POST", cache: "no-store" }
    );
    return json(res);
  },

  async trackStart(sourceId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(sourceId)}/track/start`,
      { method: "POST", cache: "no-store" }
    );
    return json(res);
  },

  async trackComplete(sourceId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(sourceId)}/track/complete`,
      { method: "POST", cache: "no-store" }
    );
    return json(res);
  },
};

export default ParticipantSourceModel;
