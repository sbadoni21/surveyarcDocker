// ============================================
// SHARED UTILITIES
// ============================================

// utils/categoryApiHelpers.js
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";

export const ENC = process.env.ENCRYPT_CATEGORIES === "1";
export const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;

export async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);

    // try decrypt object
    if (json && typeof json === "object" && !Array.isArray(json)) {
      try {
        const dec = await decryptGetResponse(json);
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    // try decrypt each array item
    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) => {
            if (item && typeof item === "object") {
              try { return await decryptGetResponse(item); } catch { return item; }
            }
            return item;
          })
        );
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    // primitive
    return NextResponse.json(json, { status: res.status });
  } catch {
    // not JSON
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}