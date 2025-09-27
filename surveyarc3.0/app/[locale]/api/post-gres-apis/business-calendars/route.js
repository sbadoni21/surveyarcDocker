// app/api/post-gres-apis/slas/business-calendars/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

// ----- shared decrypt helper (GET) -----
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
      } catch { return NextResponse.json(json, { status: res.status }); }
    }
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/business-calendars?org_id=...&active=...
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  
  for (const k of ["org_id", "active"]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") qs.set(k, v);
  }

  try {
    const res = await fetch(`${BASE}/business-calendars?${qs.toString()}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    
    // Handle empty response gracefully
    if (!res.ok && res.status === 404) {
      return NextResponse.json([], { status: 200 });
    }
    
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

// POST /api/post-gres-apis/slas/business-calendars
export async function POST(req) {
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/business-calendars`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}