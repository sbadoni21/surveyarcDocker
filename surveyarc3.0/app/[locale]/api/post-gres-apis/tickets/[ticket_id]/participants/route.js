// app/api/post-gres-apis/tickets/[ticket_id]/participants/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
    catch { return NextResponse.json(json, { status: res.status }); }
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET quick view of group_id, team_ids, agent_ids, assignee_id
export async function GET(_req, { params }) {
  const { ticket_id } = await params;
  try {
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}/participants`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
