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
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") || "en";

  const res = await fetch(
    `${BASE}/questions/${params.questionId}/translated?locale=${locale}`
  );

  const text = await res.text();
  const parsed = JSON.parse(text);

  if (parsed?.ciphertext) {
    return NextResponse.json(await decryptGetResponse(parsed));
  }
  return NextResponse.json(parsed, { status: res.status });
}