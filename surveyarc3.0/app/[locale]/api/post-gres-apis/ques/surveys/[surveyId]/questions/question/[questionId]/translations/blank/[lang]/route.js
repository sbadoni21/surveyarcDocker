import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_QUESTIONS === "1";

const looksEncrypted = (o) =>
  o && typeof o === "object" &&
  "key_id" in o && "encrypted_key" in o &&
  "ciphertext" in o && "iv" in o && "tag" in o;

const safeParse = (t) => { try { return { ok: true, json: JSON.parse(t) }; } catch { return { ok: false, raw: t }; } };
export async function GET(_, { params }) {
  const { questionId, locale } = params;
  const res = await fetch(
    `${BASE}/questions/${questionId}/translations/blank/${locale}`
  );

  const parsed = JSON.parse(await res.text());
  if (parsed?.ciphertext) {
    return NextResponse.json(await decryptGetResponse(parsed));
  }
  return NextResponse.json(parsed);
}