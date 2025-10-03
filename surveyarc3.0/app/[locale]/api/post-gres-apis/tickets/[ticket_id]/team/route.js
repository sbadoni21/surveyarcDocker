// app/api/post-gres-apis/tickets/[ticket_id]/team/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    try { 
      return NextResponse.json(await decryptGetResponse(json), { status: res.status }); 
    } catch { 
      return NextResponse.json(json, { status: res.status }); 
    }
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

/**
 * POST assign single team to ticket
 * body: { team_id: string | null }
 * Set to null to clear the team assignment
 */
export async function POST(req, { params }) {
  const { ticket_id } = await params;
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}/team`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      detail: "Upstream error", 
      message: String(e?.message || e) 
    }, { status: 500 });
  }
}