import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

async function forceDecrypt(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    try { const dec = await decryptGetResponse(json); return NextResponse.json(dec, { status: res.status }); }
    catch { return NextResponse.json(json, { status: res.status }); }
  } catch { return NextResponse.json({ raw: text }, { status: res.status }); }
}

export async function GET(_req, { params }) {
  const { ticket_id } = await params;
  const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}/sla/timers`, {
    signal: AbortSignal.timeout(30000),
  });
  return forceDecrypt(res);
}
