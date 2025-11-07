// utils/findDuplicateSurveys.js

/**
 * Helpers
 */
function toStr(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.flat(Infinity).map(x => String(x).trim().toLowerCase()).sort().join("|");
  if (typeof v === "string") return v.trim().toLowerCase();
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * Build a stable identity key for a response using:
 *  - respondent_id (preferred) OR
 *  - a combination of identityFields from answers (fallback)
 *
 * answers: array of { questionId, answer } OR { question_id, answer } shapes
 * identityFields: array of questionId strings to use (e.g. ["Q_email","Q_phone"])
 */
export function buildIdentityKey(response = {}, identityFields = []) {
  // 1) respondent_id if present and not 'anonymous' (or explicitly flagged)
  const respondentId = response.respondent_id ?? response.respondentId ?? null;
  if (respondentId && respondentId !== "anonymous" && respondentId !== "anon") {
    return `RID:${String(respondentId)}`;
  }

  // 2) fallback: use provided identityFields from answers
  const answers = Array.isArray(response.answers) ? response.answers : (response.rawAnswers || []);
  if (!Array.isArray(answers)) return "IDENT:__empty__";

  const map = new Map();
  for (const a of answers) {
    const qId = a.questionId ?? a.question_id ?? a.question ?? null;
    if (!qId) continue;
    const val = a.answer ?? a.value ?? a; // supports multiple shapes
    map.set(String(qId), toStr(val));
  }

  // construct key using only requested identityFields (in order)
  if (Array.isArray(identityFields) && identityFields.length) {
    const parts = identityFields.map((qid) => `${qid}=${map.get(qid) ?? ""}`);
    return `IDENT:${parts.join("|")}`;
  }

  // fallback: use all available answers sorted by question id
  const allKeys = Array.from(map.keys()).sort();
  const parts = allKeys.map(k => `${k}=${map.get(k) ?? ""}`);
  return `IDENT:${parts.join("|")}`;
}

/**
 * findDuplicateSurveys
 *
 * responses: array of response objects. each response should have at least:
 *   - response_id or responseId (unique)
 *   - respondent_id or respondentId (may be "anonymous")
 *   - survey_id or surveyId
 *   - answers: array [{ questionId, answer }]
 *
 * opts:
 *  - identityFields: array of questionIds to use for identity fallback (emails/phone)
 *  - surveyCopyMap: object mapping surveyId -> canonicalSurveyId (e.g. { "survey_copyA": "survey_master", ... })
 *       If not provided, responses are grouped only by survey_id as-is.
 *  - minGroupSize: minimum duplicates to return (default 2)
 *  - ignoreAnonymousIfNoIdentity: if true, ignore pure anonymous responses that have no identityFields (default false)
 *
 * Returns:
 * {
 *   byRespondentKey: { [identityKey]: { responses: [...], count } },
 *   respondentDuplicates: [ { identityKey, responses: [...], count, bySurvey: {surveyId: count} } ],
 *   surveyCopyGroups: { canonicalSurveyId: { responses: [...], count } }, // grouping of responses across copy mapping
 *   crossCopyDuplicates: [ { identityKey, canonicalSurveyId, responses: [...], count } ],
 * }
 */
export function findDuplicateSurveys(responses = [], opts = {}) {
  const {
    identityFields = [],
    surveyCopyMap = {},
    minGroupSize = 2,
    ignoreAnonymousIfNoIdentity = false,
  } = opts || {};

  // Normalize inputs
  const respList = Array.isArray(responses) ? responses : [];

  // 1) Build identity map: identityKey -> array of responses
  const identityMap = new Map();
  for (const r of respList) {
    const respId = r.response_id ?? r.responseId ?? r.id ?? `resp_${Math.random().toString(36).slice(2,8)}`;
    const key = buildIdentityKey(r, identityFields);

    // If ignoring pure anonymous with no identity detail:
    if (ignoreAnonymousIfNoIdentity) {
      const hasRespondentId = r.respondent_id || r.respondentId;
      const usingFallbackIdentity = key.startsWith("IDENT:");
      const fallbackEmpty = /^IDENT:(?:\s*|$)/.test(key) || key.endsWith("=|") || key.endsWith("=");
      if (!hasRespondentId && fallbackEmpty) {
        // skip indexing this anonymous response (no usable identity)
        continue;
      }
    }

    if (!identityMap.has(key)) identityMap.set(key, []);
    identityMap.get(key).push({ ...r, _rid: respId });
  }

  // 2) Survey canonical mapping function
  const getCanonicalSurvey = (surveyId) => {
    if (!surveyId) return null;
    if (surveyCopyMap && surveyCopyMap[surveyId]) return surveyCopyMap[surveyId];
    return surveyId;
  };

  // 3) Group responses by canonical survey id (useful to detect copies)
  const surveyMap = new Map();
  for (const r of respList) {
    const surveyId = r.survey_id ?? r.surveyId ?? r.survey ?? null;
    const canon = getCanonicalSurvey(surveyId) ?? surveyId;
    if (!surveyMap.has(canon)) surveyMap.set(canon, []);
    surveyMap.get(canon).push(r);
  }

  // 4) Build outputs
  const byRespondentKey = {};
  const respondentDuplicates = [];
  const crossCopyDuplicates = [];

  for (const [key, arr] of identityMap.entries()) {
    byRespondentKey[key] = { responses: arr, count: arr.length };

    if (arr.length >= minGroupSize) {
      // duplicate responses by same identity
      const bySurvey = {};
      for (const r of arr) {
        const canon = getCanonicalSurvey(r.survey_id ?? r.surveyId ?? r.survey) ?? (r.survey_id ?? r.surveyId ?? r.survey);
        bySurvey[canon] = (bySurvey[canon] || 0) + 1;
      }
      respondentDuplicates.push({ identityKey: key, responses: arr, count: arr.length, bySurvey });
    }

    // Also check cross-copy duplicates: same identity appearing across multiple canonical surveys
    const byCanonSet = new Map();
    for (const r of arr) {
      const canon = getCanonicalSurvey(r.survey_id ?? r.surveyId ?? r.survey) ?? (r.survey_id ?? r.surveyId ?? r.survey);
      if (!byCanonSet.has(canon)) byCanonSet.set(canon, []);
      byCanonSet.get(canon).push(r);
    }
    if (byCanonSet.size > 1) {
      // same identity has responses across multiple (canonical) surveys
      for (const [canon, responsesInCanon] of byCanonSet.entries()) {
        if (responsesInCanon.length >= 1) {
          // if identity appeared in this canonical survey and also in others, mark
          crossCopyDuplicates.push({ identityKey: key, canonicalSurveyId: canon, responses: responsesInCanon, count: responsesInCanon.length, totalByIdentity: arr.length });
        }
      }
    }
  }

  // 5) Also build surveyCopyGroups summary
  const surveyCopyGroups = {};
  for (const [canon, arr] of surveyMap.entries()) {
    surveyCopyGroups[canon] = { responses: arr, count: arr.length };
  }

  // sort duplicates by descending count for convenience
  respondentDuplicates.sort((a,b) => b.count - a.count);
  crossCopyDuplicates.sort((a,b) => b.totalByIdentity - a.totalByIdentity);

  return {
    byRespondentKey,
    respondentDuplicates,
    surveyCopyGroups,
    crossCopyDuplicates,
  };
}
