
// ============================================================
// File: app/api/questions/translations/surveys/[surveyId]/route.js
// GET all translations for survey questions
// ============================================================

import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

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
 * GET /api/questions/translations/surveys/[surveyId]?locale=es
 * Get translations for all questions in a survey
 */
export async function GET(req, { params }) {
  try {
    const { surveyId } = params;
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale");

    if (!surveyId) {
      return NextResponse.json(
        { status: "error", message: "surveyId is required" },
        { status: 400 }
      );
    }

    let url = `${BASE}/questions/surveys/${encodeURIComponent(surveyId)}/translations`;
    if (locale) {
      url += `?locale=${encodeURIComponent(locale)}`;
    }

    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
    });

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
