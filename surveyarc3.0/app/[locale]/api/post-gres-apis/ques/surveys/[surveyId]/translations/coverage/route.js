import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

const looksEncrypted = (o) =>
  o &&
  typeof o === "object" &&
  "key_id" in o &&
  "encrypted_key" in o &&
  "ciphertext" in o &&
  "iv" in o &&
  "tag" in o;

export async function GET(_req, { params }) {
  const { surveyId } = await params;

  const res = await fetch(
    `${BASE}/questions/surveys/${encodeURIComponent(
      surveyId
    )}/translations/coverage`,
    { cache: "no-store" }
  );

  const text = await res.text();

  try {
    const json = JSON.parse(text);

    if (looksEncrypted(json)) {
      return NextResponse.json(await decryptGetResponse(json));
    }

    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Invalid response from backend", raw: text },
      { status: 500 }
    );
  }
}
