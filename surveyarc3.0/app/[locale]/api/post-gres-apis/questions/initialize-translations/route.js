// File: app/api/questions/initialize-translations/route.js

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
 * POST /api/questions/initialize-translations
 * Initialize blank translation structures for all questions in a survey
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { survey_id, locale } = body;

    if (!survey_id || !locale) {
      return NextResponse.json(
        { status: "error", message: "survey_id and locale are required" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;
    
    const res = await fetch(`${BASE}/questions/initialize-translations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
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