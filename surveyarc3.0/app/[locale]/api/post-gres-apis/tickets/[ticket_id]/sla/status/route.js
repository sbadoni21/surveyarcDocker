// app/api/post-gres-apis/slas/tickets/[ticket_id]/status/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;

async function forceDecryptResponse(res) {
  const txt = await res.text();
  try {
    const json = JSON.parse(txt);
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: txt }, { status: res.status });
  }
}

export async function GET(_req, { params }) {
  const { ticket_id } = await params;
  try {
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}/sla/status`, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
