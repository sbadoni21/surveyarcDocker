// ============================================================
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
const BASE = process.env.FASTAPI_BASE_URL;


const looksEncrypted = (o) =>
  o && typeof o === "object" &&
  "key_id" in o &&
  "encrypted_key" in o &&
  "ciphertext" in o &&
  "iv" in o &&
  "tag" in o;

const safeParse = (t) => {
  try {
    return { ok: true, json: JSON.parse(t) };
  } catch {
    return { ok: false, raw: t };
  }
};
export async function GET(req, { params }) {
  const { surveyId } = await params;
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale");

  const url =
    `${BASE}/questions/surveys/${surveyId}/questions` +
    (locale ? `?locale=${locale}` : "");

  const res = await fetch(url);
  const text = await res.text();
  const parsed = safeParse(text);

  if (parsed.ok && looksEncrypted(parsed.json)) {
    return NextResponse.json(await decryptGetResponse(parsed.json));
  }
  return NextResponse.json(parsed.json ?? parsed.raw, { status: res.status });
}
