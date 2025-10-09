// models/postGresModels/responseModel.js
const BASE = "/api/post-gres-apis/responses";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const ResponseModel = {
  /**
   * Create a new response
   * POST /responses
   */
  async create(orgId, surveyId, data) {
    const body = {
      org_id: orgId,
      survey_id: surveyId,
      respondent_id: data.respondent_id,
      status: data.status || "started",
      meta_data: data.meta_data || {},
      answers: data.answers || [],
    };

    // console.log("body inside responseModel:", body);

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Get response by survey and response ID
   * GET /responses/{survey_id}/{response_id}
   */
  async get(surveyId, responseId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(responseId)}`,
      { method: "GET", cache: "no-store" }
    );
    return json(res);
  },

  /**
   * List all responses for a survey
   * GET /responses/survey/{survey_id}
   */
  async getAllBySurvey(surveyId) {
    const res = await fetch(`${BASE}/survey/${encodeURIComponent(surveyId)}`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Update a response
   * PATCH /responses/{survey_id}/{response_id}
   */
  async update(surveyId, responseId, updateData) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(responseId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
        cache: "no-store",
      }
    );
    return json(res);
  },

  /**
   * Delete a response
   * DELETE /responses/{survey_id}/{response_id}
   */
  async delete(surveyId, responseId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(responseId)}`,
      { method: "DELETE", cache: "no-store" }
    );
    return json(res);
  },

  /**
   * Count all responses of a survey
   * GET /responses/survey/{survey_id}/count
   */
  async count(surveyId) {
    const res = await fetch(`${BASE}/survey/${encodeURIComponent(surveyId)}/count`, {
      method: "GET",
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Mark response as completed
   * POST /responses/{survey_id}/{response_id}/complete
   */
  async complete(surveyId, responseId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(surveyId)}/${encodeURIComponent(responseId)}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    return json(res);
  },
};

export default ResponseModel;
