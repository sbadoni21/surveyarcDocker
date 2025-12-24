// ============================================================
// QuestionModel (Provider-Compatible)
// - Keeps ALL function names exactly as used in QuestionProvider
// - Uses `ques` routes internally
// - Uses `lang` instead of locale
// - Defaults lang = "en"
// - Sends ONLY x-user-id from cookie: currentUserId
// ============================================================

const BASE = "/api/post-gres-apis/ques";

// ----------------------------
// Helpers
// ----------------------------

const normalizeLang = (lang) => lang || "en";

/**
 * 🍪 Read currentUserId from cookies
 */
const getUserIdFromCookie = () => {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("currentUserId="));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
};

/**
 * 🔐 Headers for ALL requests
 */
const headersWithUser = (extra = {}) => {
  const userId = getUserIdFromCookie();
  return {
    "Content-Type": "application/json",
    ...(userId ? { "x-user-id": userId } : {}),
    ...extra,
  };
};

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const toCamel = (q) => ({
  questionId: q.question_id,
  surveyId: q.survey_id,
  orgId: q.org_id,
  projectId: q.project_id,
  serial_label: q.serial_label,
  type: q.type,
  label: q.label,
  description: q.description,
  required: q.required,
  config: q.config,
  logic: q.logic,
  translations: q.translations || {},
  createdAt: q.created_at,
  updatedAt: q.updated_at,
});

// ============================================================
// MODEL (DO NOT RENAME FUNCTIONS)
// ============================================================

const QuestionModel = {
  // ==========================================================
  // QUESTION CRUD
  // ==========================================================

  async create(orgId, surveyId, data) {
    console.log("first", data);
    const payload = {
      org_id: orgId,
      survey_id: surveyId,
      project_id: data.projectId,
      question_id: data.questionId,
      type: data.type,
      label: data.label,
      serial_label: data.serial_label,
      required: data.required ?? true,
      description: data.description || "",
      config: data.config || {},
      logic: data.logic || [],
    };
    // if (data.serial_label && data.serial_label.trim()) {
    //   payload.serial_label = data.serial_label.trim();
    // }

    console.log("target", payload);

    const res = await fetch(`${BASE}`, {
      method: "POST",
      headers: headersWithUser(),
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    return toCamel(await json(res));
  },

  async getAll(orgId, surveyId) {
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(surveyId)}/questions?lang=en`,
      { cache: "no-store" }
    );

    return (await json(res)).map(toCamel);
  },

  async get(orgId, surveyId, questionId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(questionId)}?lang=en`,
      { cache: "no-store" }
    );

    return toCamel(await json(res));
  },

  async update(orgId, surveyId, questionId, updateData) {
    const res = await fetch(`${BASE}/${encodeURIComponent(questionId)}`, {
      method: "PATCH",
      headers: headersWithUser(),
      body: JSON.stringify(updateData),
      cache: "no-store",
    });
    return toCamel(await json(res));
  },

  async updateLogic(questionId, logic) {
    const res = await fetch(`${BASE}/${questionId}`, {
      method: "PATCH",
      headers: headersWithUser(),
      body: JSON.stringify({
        logic,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to update logic");
    }
    return await res.json();
  },

  async delete(orgId, surveyId, questionId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(questionId)}`, {
      method: "DELETE",
      headers: headersWithUser({ "Content-Type": undefined }),
      cache: "no-store",
    });
    return json(res);
  },

  async getBulkQuestions(questionIds) {
    const res = await fetch(`${BASE}/bulk`, {
      method: "POST",
      headers: headersWithUser(),
      body: JSON.stringify({
        question_ids: questionIds,
        lang: "en",
      }),
      cache: "no-store",
    });
    return (await json(res)).map(toCamel);
  },
  // QuestionModel.js

  async resyncSurveyTranslations(surveyId) {
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(surveyId)}/translations/resync`,
      {
        method: "POST",
        headers: headersWithUser(),
        cache: "no-store",
      }
    );
    return json(res);
  },

  // ==========================================================
  // SINGLE QUESTION TRANSLATION
  // ==========================================================

  async getQuestionTranslations(surveyId, questionId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(questionId)}/translations`,
      { cache: "no-store" }
    );
    return json(res);
  },

  async getQuestionTranslation(surveyId, questionId, locale) {
    const lang = normalizeLang(locale);
    const res = await fetch(
      `${BASE}/${encodeURIComponent(
        questionId
      )}/translations/${encodeURIComponent(lang)}`,
      { cache: "no-store" }
    );
    return json(res);
  },

  async getQuestionWithTranslation(surveyId, questionId, locale) {
    const lang = normalizeLang(locale);
    const res = await fetch(
      `${BASE}/${encodeURIComponent(
        questionId
      )}/translated?lang=${encodeURIComponent(lang)}`,
      { cache: "no-store" }
    );
    return json(res);
  },

  async getBlankTranslationStructure(surveyId, questionId, locale) {
    const lang = normalizeLang(locale);
    const res = await fetch(
      `${BASE}/${encodeURIComponent(
        questionId
      )}/translations/blank/${encodeURIComponent(lang)}`,
      { cache: "no-store" }
    );
    return json(res);
  },

  async updateQuestionTranslation(
    surveyId,
    questionId,
    locale,
    translationData
  ) {
    const lang = normalizeLang(locale);
    const url = `${BASE}/${encodeURIComponent(
      questionId
    )}/translations/${encodeURIComponent(lang)}`;
    console.log("🔍 Calling API:", {
      url,
      method: "PUT",
      questionId,
      locale: lang,
      body: { locale: lang, ...translationData },
    });

    const res = await fetch(url, {
      method: "PUT",
      headers: headersWithUser(),
      body: JSON.stringify({ locale: lang, ...translationData }),
      cache: "no-store",
    });

    console.log("📡 Response:", res.status, res.statusText);

    return json(res);
  },

  async deleteQuestionTranslation(surveyId, questionId, locale) {
    const lang = normalizeLang(locale);
    const res = await fetch(
      `${BASE}/${encodeURIComponent(
        questionId
      )}/translations/${encodeURIComponent(lang)}`,
      {
        method: "DELETE",
        headers: headersWithUser({ "Content-Type": undefined }),
        cache: "no-store",
      }
    );
    return json(res);
  },

  async deleteAllQuestionTranslations(surveyId, questionId) {
    const res = await fetch(
      `${BASE}/${encodeURIComponent(questionId)}/translations?confirm=true`,
      {
        method: "DELETE",
        headers: headersWithUser({ "Content-Type": undefined }),
        cache: "no-store",
      }
    );
    return json(res);
  },

  // ==========================================================
  // SURVEY-LEVEL TRANSLATION
  // ==========================================================

  async initializeTranslations(surveyId, locale) {
    console.log(surveyId, locale);
    const lang = normalizeLang(locale);
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(surveyId)}/translations/initialize`,
      {
        method: "POST",
        headers: headersWithUser(),
        body: JSON.stringify({ survey_id: surveyId, locale }),
        cache: "no-store",
      }
    );
    return json(res);
  },

  async getTranslationStatus(surveyId) {
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(surveyId)}/translations/coverage`,
      { cache: "no-store" }
    );
    return json(res);
  },

  async getSurveyTranslations(surveyId, locale = null) {
    const lang = locale ? `?lang=${encodeURIComponent(locale)}` : "";
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(surveyId)}/translations${lang}`,
      { cache: "no-store" }
    );
    return json(res);
  },

  async bulkUpdateTranslations(surveyId, bulkData) {
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(surveyId)}/translations/bulk`,
      {
        method: "PUT",
        headers: headersWithUser(),
        body: JSON.stringify(bulkData),
        cache: "no-store",
      }
    );
    return json(res);
  },

  async deleteTranslation(surveyId, locale) {
    const lang = normalizeLang(locale);
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(
        surveyId
      )}/translations/${encodeURIComponent(lang)}`,
      {
        method: "DELETE",
        headers: headersWithUser({ "Content-Type": undefined }),
        cache: "no-store",
      }
    );
    return json(res);
  },
  async uploadTranslationCSV(surveyId, file, dryRun = false) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("dry_run", dryRun.toString());

    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(surveyId)}/translations/upload-csv`,
      {
        method: "POST",
        headers: headersWithUser({ "Content-Type": undefined }), // Let browser set multipart boundary
        body: formData,
        cache: "no-store",
      }
    );

    return json(res);
  },
  async exportTranslationCSV(surveyId, includeValues = true, locales = null) {
    const params = new URLSearchParams({
      include_values: includeValues.toString(),
    });

    if (locales && locales.length > 0) {
      params.append("locales", locales.join(","));
    }

    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(
        surveyId
      )}/translations/export-csv?${params}`,
      {
        method: "GET",
        headers: headersWithUser({ "Content-Type": undefined }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Export failed: ${text}`);
    }

    return res.blob();
  },
  async downloadTranslationCSV(surveyId, includeValues = true, locales = null) {
    const blob = await this.exportTranslationCSV(
      surveyId,
      includeValues,
      locales
    );

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translations_${surveyId}.csv`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  async validateTranslationCSV(surveyId, file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(
        surveyId
      )}/translations/validate-csv`,
      {
        method: "POST",
        headers: headersWithUser({ "Content-Type": undefined }),
        body: formData,
        cache: "no-store",
      }
    );

    return json(res);
  },
  async uploadTranslationCSVWithProgress(
    surveyId,
    file,
    onProgress,
    dryRun = false
  ) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dry_run", dryRun.toString());

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (e) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.open(
        "POST",
        `${BASE}/surveys/${encodeURIComponent(
          surveyId
        )}/translations/upload-csv`
      );

      // Add auth header
      const userId = getUserIdFromCookie();
      if (userId) {
        xhr.setRequestHeader("x-user-id", userId);
      }

      xhr.send(formData);
    });
  },
  async getAllWithLocale(orgId, surveyId, locale) {
    const lang = normalizeLang(locale);
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(
        surveyId
      )}/questions?lang=${encodeURIComponent(lang)}`,
      { cache: "no-store" }
    );
    return (await json(res)).map(toCamel);
  },
};

export default QuestionModel;
