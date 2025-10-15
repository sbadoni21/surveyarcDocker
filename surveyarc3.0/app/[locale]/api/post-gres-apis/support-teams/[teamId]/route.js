
// app/api/post-gres-apis/support-teams/[team_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SUPPORT === "1";

/** Decrypt-if-needed helper */
async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object" && !Array.isArray(json)) {
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
  const { teamId } =  await params;
  
  try {
    const res = await fetch(`${BASE}/support-teams/${encodeURIComponent(teamId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      error: "Failed to fetch support team", 
      detail: String(e?.message || e) 
    }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { teamId } = await params;
  
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/support-teams/${encodeURIComponent(teamId)}`, {
      method: "PATCH",
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
      error: "Failed to update support team", 
      detail: String(e?.message || e) 
    }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { team_id } = await params;
  
  try {
    const res = await fetch(`${BASE}/support-teams/${encodeURIComponent(team_id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
    });
    
    if (res.status === 204) {
      return NextResponse.json({ success: true }, { status: 204 });
    }
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      error: "Failed to delete support team", 
      detail: String(e?.message || e) 
    }, { status: 500 });
  }
}
