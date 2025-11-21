// app/api/post-gres-apis/tickets/[ticket_id]/worklogs/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { cookies } from "next/headers";

const BASE = process.env.FASTAPI_BASE_URL;

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

export async function GET(req, { params }) {
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
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}/worklogs`, {
      headers,
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


export async function POST(req, { params }) {
  const { ticket_id } = await params;

  // Get body
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json(
      { detail: "Invalid JSON body", message: e.message },
      { status: 400 }
    );
  }

  // Prepare headers
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  // Get user ID
  const cookieStore = await cookies();
  const userId = cookieStore.get("currentUserId")?.value || req.headers.get("x-user-id");
  if (userId) headers.set("X-User-Id", userId);

  try {
    const res = await fetch(
      `${BASE}/tickets/${encodeURIComponent(ticket_id)}/worklogs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      }
    );

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
