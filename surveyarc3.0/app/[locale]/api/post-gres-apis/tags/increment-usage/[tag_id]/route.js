
// app/api/post-gres-apis/tags/increment-usage/[tag_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

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

// POST /api/post-gres-apis/tags/increment-usage/[tag_id] - Increment tag usage
export async function POST(_req, { params }) {
  const { tag_id } = params;
  console.log("[POST] Incrementing usage for tag:", tag_id);
  
  try {
    const payload = ENC ? await encryptPayload({}) : {};
    
    const res = await fetch(`${BASE}/tags/${encodeURIComponent(tag_id)}/increment-usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    console.log("[POST] Backend response status:", res.status);
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[POST] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}