
// app/api/post-gres-apis/tags/categories/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

async function forceDecryptResponse(res) {
  const text = await res.text();

  try {
    const json = JSON.parse(text);

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

// GET /api/post-gres-apis/tags/categories - Get tag categories
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  
  try {
    const queryString = searchParams.toString();
    const url = `${BASE}/tags/categories${queryString ? `?${queryString}` : ''}`;
    
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[GET] ❌ Error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}