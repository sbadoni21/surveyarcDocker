
// app/api/post-gres-apis/tags/[tag_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

// Same forceDecryptResponse function
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

    console.log("[forceDecryptResponse] Primitive JSON value:", json);
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    console.warn("[forceDecryptResponse] ❌ Failed to parse JSON, returning raw text:", err);
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/tags/[tag_id] - Get single tag
export async function GET(_req, { params }) {
  const { tag_id } = params;
  console.log("[GET] Fetching tag:", tag_id);
  try {
    const res = await fetch(`${BASE}/tags/${encodeURIComponent(tag_id)}`, {
      signal: AbortSignal.timeout(30000),
    });
    console.log("[GET] Backend response status:", res.status);
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[GET] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH /api/post-gres-apis/tags/[tag_id] - Update tag
export async function PATCH(req, { params }) {
  const { tag_id } = params;
  try {
    const raw = await req.json();
    console.log("[PATCH] Incoming body:", raw);

    const payload = ENC ? await encryptPayload(raw) : raw;
    console.log("[PATCH] Final payload (maybe encrypted):", payload);

    const res = await fetch(`${BASE}/tags/${encodeURIComponent(tag_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    console.log("[PATCH] Backend response status:", res.status);
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[PATCH] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

// DELETE /api/post-gres-apis/tags/[tag_id] - Delete tag
export async function DELETE(_req, { params }) {
  const { tag_id } = params;
  console.log("[DELETE] Deleting tag:", tag_id);
  try {
    const res = await fetch(`${BASE}/tags/${encodeURIComponent(tag_id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
    });
    console.log("[DELETE] Backend response status:", res.status);
    
    // Handle 204 No Content response
    if (res.status === 204) {
      return NextResponse.json({ success: true }, { status: 204 });
    }
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[DELETE] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}