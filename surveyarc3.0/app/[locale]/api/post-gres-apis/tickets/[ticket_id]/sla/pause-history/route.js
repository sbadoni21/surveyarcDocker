// app/api/post-gres-apis/slas/tickets/[ticket_id]/pause-history/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

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

export async function GET(req, { params }) {
  const { ticket_id } = await params;
  const url = new URL(req.url);
  const dimension = url.searchParams.get("dimension");

  const qs = new URLSearchParams();
  if (dimension) qs.set("dimension", dimension);

  try {
    const res = await fetch(
      `${BASE}/tickets/${encodeURIComponent(ticket_id)}/sla/pause-history${qs.toString() ? `?${qs.toString()}` : ""}`,
      { method: "GET", signal: AbortSignal.timeout(30000), cache: "no-store" }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
