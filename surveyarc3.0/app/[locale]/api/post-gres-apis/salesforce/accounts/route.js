import { decryptGetResponse } from "@/utils/crypto_client";
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

/** Decrypt-if-needed helper for arrays */
async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    
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
    
    if (json && typeof json === "object") {
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
// GET /api/post-gres-apis/salesforce/accounts
export async function GET(req) {
  try {
    const urlParams = req.nextUrl.searchParams;
    const limit = urlParams.get("limit") ?? 50;

    const res = await fetch(`${BASE}/salesforce/accounts?limit=${limit}`, {
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
