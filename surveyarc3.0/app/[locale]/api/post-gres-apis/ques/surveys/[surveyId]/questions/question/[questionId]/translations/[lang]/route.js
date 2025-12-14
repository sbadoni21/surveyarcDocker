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
export async function DELETE(_, { params }) {
  const { questionId, locale } = params;
  const res = await fetch(
    `${BASE}/questions/${questionId}/translations/${locale}`,
    { method: "DELETE" }
  );

  return NextResponse.json(await res.json(), { status: res.status });
}