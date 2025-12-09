// app/en/api/post-gres-apis/salesforce-campaigns/sync-status/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

const looksEnvelope = (o) =>
  o &&
  typeof o === "object" &&
  "key_id" in o &&
  "encrypted_key" in o &&
  "ciphertext" in o &&
  "iv" in o &&
  "tag" in o;

async function forceDecryptResponse(res) {
  const text = await res.text();

  try {
    const json = JSON.parse(text);

    if (looksEnvelope(json)) {
      try {
        const dec = await decryptGetResponse(json);
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}

// GET /en/api/post-gres-apis/salesforce-campaigns/sync-status
export async function GET() {
  try {
    const res = await fetch(`${BASE}/salesforce-campaigns/sync-status`, {
      signal: AbortSignal.timeout(30000),
      credentials: "include", // if you forward auth cookies via middleware
    });

    return forceDecryptResponse(res);
  } catch (error) {
    console.error("[sync-status] error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
