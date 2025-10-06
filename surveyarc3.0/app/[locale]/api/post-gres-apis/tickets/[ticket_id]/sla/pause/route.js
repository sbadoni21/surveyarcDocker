// app/api/post-gres-apis/tickets/[ticket_id]/sla/pause/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { cookies } from "next/headers";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

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

export async function POST(req, { params }) {
  const { ticket_id } = await params;
  
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  
  // Get user ID from cookie or header
  const cookieStore = await cookies();
  const userId = cookieStore.get('currentUserId')?.value || req.headers.get("x-user-id");
  
  if (userId) {
    headers.set("X-User-Id", userId);
  }
  
  try {
    const body = await req.json();
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}/sla/pause`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      detail: "Upstream error", 
      message: String(e?.message || e) 
    }, { status: 500 });
  }
}