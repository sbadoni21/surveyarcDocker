import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_QUESTIONS === "1";

const looksEncrypted = (o) =>
  o && typeof o === "object" &&
  "key_id" in o && "encrypted_key" in o &&
  "ciphertext" in o && "iv" in o && "tag" in o;

const safeParse = (t) => { try { return { ok: true, json: JSON.parse(t) }; } catch { return { ok: false, raw: t }; } };

export async function GET(_req, { params }) {
  const { surveyId, questionId } = params;
  const url = `${BASE}/questions/${encodeURIComponent(surveyId)}/${encodeURIComponent(questionId)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    const parsed = safeParse(text);
    if (parsed.ok && looksEncrypted(parsed.json)) {
      const dec = await decryptGetResponse(parsed.json);
      return NextResponse.json(dec, { status: res.status });
    }
    return NextResponse.json(parsed.ok ? parsed.json : { status: "error", raw: parsed.raw }, { status: res.status });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { surveyId, questionId } = params;
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/questions/${encodeURIComponent(surveyId)}/${encodeURIComponent(questionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const text = await res.text();
    const parsed = safeParse(text);
    if (parsed.ok && looksEncrypted(parsed.json)) {
      const dec = await decryptGetResponse(parsed.json);
      return NextResponse.json(dec, { status: res.status });
    }
    return NextResponse.json(parsed.ok ? parsed.json : { status: "error", raw: parsed.raw }, { status: res.status });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { surveyId, questionId } = params;
  try {
    const res = await fetch(`${BASE}/questions/${encodeURIComponent(surveyId)}/${encodeURIComponent(questionId)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const parsed = safeParse(text);
    return NextResponse.json(parsed.ok ? parsed.json : { status: "error", raw: parsed.raw }, { status: res.status });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}
