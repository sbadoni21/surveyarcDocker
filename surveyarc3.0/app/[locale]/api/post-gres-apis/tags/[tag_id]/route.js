
// app/api/post-gres-apis/tags/[tag_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

// Same forceDecryptResponse function
async function forceDecryptResponse(res) {
  const text = await res.text();

  try {
    const json = JSON.parse(text);

    if (json && typeof json === "object" && !Array.isArray(json)) {
      try {
        const dec = await decryptGetResponse(json);
        return NextResponse.json(dec, { status: res.status });
      } catch (err) {
        console.warn("[forceDecryptResponse] ❌ Decrypt failed, returning raw JSON:", err);
        return NextResponse.json(json, { status: res.status });
      }
    }

    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item, i) => {
            if (item && typeof item === "object") {
              try {
                const d = await decryptGetResponse(item);
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

    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    console.warn("[forceDecryptResponse] ❌ Failed to parse JSON, returning raw text:", err);
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/tags/[tag_id] - Get single tag
export async function GET(_req, { params }) {
  const { tag_id } = await params;
  try {
    const res = await fetch(`${BASE}/tags/${encodeURIComponent(tag_id)}`, {
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[GET] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH /api/post-gres-apis/tags/[tag_id] - Update tag
export async function PATCH(req, { params }) {
  const { tag_id } = await params;
  try {
    const raw = await req.json();

    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/tags/${encodeURIComponent(tag_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[PATCH] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

// DELETE /api/post-gres-apis/tags/[tag_id] - Delete tag
export async function DELETE(_req, { params }) {
  const { tag_id } = await params;
  try {
    const res = await fetch(`${BASE}/tags/${encodeURIComponent(tag_id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
    });
    
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