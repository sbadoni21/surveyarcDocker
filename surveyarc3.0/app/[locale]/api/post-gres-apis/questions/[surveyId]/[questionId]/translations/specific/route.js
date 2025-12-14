
// ============================================================
// File: app/api/questions/[surveyId]/[questionId]/translations/specific/route.js
// GET/PUT/DELETE specific locale translation
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
 * GET /api/questions/[surveyId]/[questionId]/translations/specific?locale=es
 * Get translation for specific locale
 */
export async function GET(req, { params }) {
  try {
    const { questionId } = params;
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale");

    if (!questionId || !locale) {
      return NextResponse.json(
        { status: "error", message: "questionId and locale are required" },
        { status: 400 }
      );
    }

    const url = `${BASE}/questions/${encodeURIComponent(questionId)}/translations/${encodeURIComponent(locale)}`;

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

/**
 * PUT /api/questions/[surveyId]/[questionId]/translations/specific?locale=es
 * Update translation for specific locale
 * Body: { locale: "es", label: "...", description: "...", config: {...} }
 */
export async function PUT(req, { params }) {
  try {
    const { questionId } = params;
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale");
    const body = await req.json();

    if (!questionId || !locale) {
      return NextResponse.json(
        { status: "error", message: "questionId and locale are required" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;
    
    const res = await fetch(
      `${BASE}/questions/${encodeURIComponent(questionId)}/translations/${encodeURIComponent(locale)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
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

/**
 * DELETE /api/questions/[surveyId]/[questionId]/translations/specific?locale=es
 * Delete specific locale translation
 */
export async function DELETE(req, { params }) {
  try {
    const { questionId } = params;
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale");

    if (!questionId || !locale) {
      return NextResponse.json(
        { status: "error", message: "questionId and locale are required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${BASE}/questions/${encodeURIComponent(questionId)}/translations/${encodeURIComponent(locale)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(30000),
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
