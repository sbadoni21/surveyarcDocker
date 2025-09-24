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

export async function POST(req) {
  try {
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/questions/`, {
      method: "POST",
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

export async function GET(req) {
  const { searchParams } =  new URL(req.url);
  const survey_id = searchParams.get("survey_id");
  if (!survey_id) {
    return NextResponse.json({ status: "error", message: "survey_id is required" }, { status: 400 });
  }
  const url = `${BASE}/questions/${encodeURIComponent(survey_id)}`;
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
