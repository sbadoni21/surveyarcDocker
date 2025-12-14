

// ============================================================
// File: app/api/questions/[surveyId]/[questionId]/translated/route.js
// GET question with translation applied
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
 * GET /api/questions/[surveyId]/[questionId]/translated?locale=es
 * Get question with translation applied
 */
export async function GET(req, { params }) {
  try {
    const { questionId } = params;
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale") || "en";

    if (!questionId) {
      return NextResponse.json(
        { status: "error", message: "questionId is required" },
        { status: 400 }
      );
    }

    const url = `${BASE}/questions/${encodeURIComponent(questionId)}/translated?locale=${encodeURIComponent(locale)}`;

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
