// app/api/post-gres-apis/tags/bulk-create/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      const dec = await Promise.all(
        json.map(async (item) => {
          if (item && typeof item === "object") {
            try {
              return await decryptGetResponse(item);
            } catch (e) {
              return item;
            }
          }
          return item;
        })
      );
      return NextResponse.json(dec, { status: res.status });
    }
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

export async function POST(req) {
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;
    
    const res = await fetch(`${BASE}/tags/bulk-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}