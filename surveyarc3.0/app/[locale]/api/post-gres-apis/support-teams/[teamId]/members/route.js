import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SUPPORT === "1";

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

export async function GET(req, { params }) {
  const { teamId } = await params;
  
  try {
    const res = await fetch(`${BASE}/support-teams/${encodeURIComponent(teamId)}/members`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      error: "Failed to fetch team members", 
      detail: String(e?.message || e) 
    }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { teamId } = await params;
  try {
    const raw = await req.json(); // { user_id, role?, proficiency?, weekly_capacity_minutes? }

    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/support-teams/${encodeURIComponent(teamId)}/members`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      error: "Failed to add team member", 
      detail: String(e?.message || e) 
    }, { status: 500 });
  }
}
