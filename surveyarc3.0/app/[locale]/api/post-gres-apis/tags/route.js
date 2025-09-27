// app/api/post-gres-apis/tags/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

// Always try to decrypt; gracefully fall back.
async function forceDecryptResponse(res) {
  const text = await res.text();
  console.log("[forceDecryptResponse] Raw text from backend:", text);

  try {
    const json = JSON.parse(text);
    console.log("[forceDecryptResponse] Parsed JSON:", json);

    // object
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

    // array
    if (Array.isArray(json)) {
      try {
        console.log("[forceDecryptResponse] Attempting to decrypt array of length:", json.length);
        const dec = await Promise.all(
          json.map(async (item, i) => {
            if (item && typeof item === "object") {
              try {
                const d = await decryptGetResponse(item);
                console.log(`[forceDecryptResponse] ✅ Decrypted item[${i}]:`, d);
                return d;
              } catch (e) {
                console.warn(`[forceDecryptResponse] ❌ Decrypt failed for item[${i}], returning raw:`, e);
                return item;
              }
            }
            return item;
          })
        );
        return NextResponse.json(dec, { status: res.status });
      } catch (err) {
        console.warn("[forceDecryptResponse] ❌ Decrypt array failed, returning raw:", err);
        return NextResponse.json(json, { status: res.status });
      }
    }

    // primitives
    console.log("[forceDecryptResponse] Primitive JSON value:", json);
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    // not JSON
    console.warn("[forceDecryptResponse] ❌ Failed to parse JSON, returning raw text:", err);
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/tags - List tags
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  console.log("[GET] Fetching tags with params:", Object.fromEntries(searchParams));
  
  try {
    const queryString = searchParams.toString();
    const url = `${BASE}/tags${queryString ? `?${queryString}` : ''}`;
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

// POST /api/post-gres-apis/tags - Create tag
export async function POST(req) {
  try {
    const raw = await req.json();
    console.log("[POST] Incoming body:", raw);

    const payload = ENC ? await encryptPayload(raw) : raw;
    console.log("[POST] Final payload (maybe encrypted):", payload);

    const res = await fetch(`${BASE}/tags`, {
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
