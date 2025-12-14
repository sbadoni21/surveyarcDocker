const BASE = "/api/post-gres-apis/questions";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const TranslationModel = {
  /**
   * Initialize blank translations for all questions in a survey
   * @param {string} surveyId
   * @param {string} locale - Language code (e.g., "es", "fr", "de")
   * @returns {Promise<{success: boolean, locale: string, questions_updated: number, message: string}>}
   */
  async initializeTranslations(surveyId, locale) {
    const res = await fetch(`${BASE}/initialize-translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        survey_id: surveyId,
        locale: locale,
      }),
      cache: "no-store",
    });
    return json(res);
  },

  /**
   * Get translation status for a survey
   * Shows which locales exist and their completion percentage
   * @param {string} surveyId
   * @returns {Promise<{survey_id: string, total_questions: number, available_locales: string[], locale_status: object}>}
   */
  async getTranslationStatus(surveyId) {
    const res = await fetch(
      `${BASE}/translation-status/${encodeURIComponent(surveyId)}`,
      { cache: "no-store" }
    );
    return json(res);
  },

  /**
   * Delete all translations for a specific locale from a survey
   * @param {string} surveyId
   * @param {string} locale
   * @returns {Promise<{success: boolean, locale: string, questions_updated: number}>}
   */
  async deleteTranslation(surveyId, locale) {
    const res = await fetch(
      `${BASE}/translations/${encodeURIComponent(surveyId)}/${encodeURIComponent(locale)}`,
      {
        method: "DELETE",
        cache: "no-store",
      }
    );
    return json(res);
  },

 
};

export default TranslationModel;