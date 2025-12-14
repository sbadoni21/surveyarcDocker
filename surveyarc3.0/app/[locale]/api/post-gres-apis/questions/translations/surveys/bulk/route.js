
// ============================================================
// File: app/api/questions/translations/surveys/[surveyId]/bulk/route.js
// PUT bulk update translations for multiple questions
// ============================================================

import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_QUESTIONS === "1";

const looksEncrypted = (o) =>
  o && typeof o === "object" &&
  "key_id" in o && "encrypted_key" in o &&
  "ciphertext" in o && "iv" in o && "tag" in o;

const safeParse = (t) => {
  try {
    return { ok: true, json: JSON.parse(t) };
  } catch {
    return { ok: false, raw: t };
  }
};

/**
 * PUT /api/questions/translations/surveys/[surveyId]/bulk
 * Bulk update translations for multiple questions
 * Body: {
 *   "question_1": { 
 *     translations: { 
 *       es: { label: "...", config: {...} },
 *       fr: { label: "...", config: {...} }
 *     } 
 *   },
 *   "question_2": { translations: {...} }
 * }
 */
export async function PUT(req, { params }) {
  try {
    const { surveyId } = params;
    const body = await req.json();

    if (!surveyId) {
      return NextResponse.json(
        { status: "error", message: "surveyId is required" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;
    
    const res = await fetch(
      `${BASE}/questions/surveys/${encodeURIComponent(surveyId)}/translations/bulk`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000), // Longer timeout for bulk operations
      }
    );

    const text = await res.text();
    const parsed = safeParse(text);

    if (parsed.ok && looksEncrypted(parsed.json)) {
      const dec = await decryptGetResponse(parsed.json);
      return NextResponse.json(dec, { status: res.status });
    }

    return NextResponse.json(
      parsed.ok ? parsed.json : { status: "error", raw: parsed.raw },
      { status: res.status }
    );
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}