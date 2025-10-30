import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

const looksEnvelope = (o) => o && typeof o === "object" && "key_id" in o && "encrypted_key" in o && "ciphertext" in o && "iv" in o && "tag" in o;
const safeParse = (t) => { try { return { ok: true, json: JSON.parse(t) }; } catch { return { ok: false, raw: t }; } };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const survey_id = searchParams.get("survey_id");
  if (!survey_id) return NextResponse.json({ status: "error", message: "survey_id is required" }, { status: 400 });

  const res = await fetch(`${BASE}/responses/count?survey_id=${encodeURIComponent(survey_id)}`, {
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  const parsed = safeParse(text);
  if (parsed.ok && looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }
  return NextResponse.json(parsed.ok ? parsed.json : { status: "error", raw: parsed.raw }, { status: res.status });
}
