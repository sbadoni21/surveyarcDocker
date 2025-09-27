
// app/api/post-gres-apis/tags/count/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

async function forceDecryptResponse(res) {
  const text = await res.text();
  console.log("[forceDecryptResponse] Raw text from backend:", text);

  try {
    const json = JSON.parse(text);
    console.log("[forceDecryptResponse] Parsed JSON:", json);

    if (json && typeof json === "object" && !Array.isArray(json)) {
      try {
        console.log("[forceDecryptResponse] Attempting to decrypt object…");
        const dec = await decryptGetResponse(json);
        console.log("[forceDecryptResponse] ✅ Decrypted object:", dec);
        return NextResponse.json(dec, { status: res.status });
      } catch (err) {
        console.warn("[forceDecryptResponse] ❌ Decrypt failed, returning raw JSON:", err);
        return NextResponse.json(json, { status: res.status });
      }
    }

    console.log("[forceDecryptResponse] Returning JSON as-is:", json);
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    console.warn("[forceDecryptResponse] ❌ Failed to parse JSON, returning raw text:", err);
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/tags/count - Get tag count
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  console.log("[GET] Fetching tag count with params:", Object.fromEntries(searchParams));
  
  try {
    const queryString = searchParams.toString();
    const url = `${BASE}/tags/count${queryString ? `?${queryString}` : ''}`;
    console.log("[GET] Backend URL:", url);
    
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });
    console.log("[GET] Backend response status:", res.status);
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[GET] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}
