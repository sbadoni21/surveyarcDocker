import { NextResponse } from "next/server";
import { forceDecryptResponse, BASE } from "@/utils/categoryApiHelpers";

export async function POST(req, { params }) {
  const { ticketId } = await params;
  const raw = await req.json().catch(() => ({}));
  if (!ticketId || !raw?.rca_id || !raw?.confirmed_by) {
    return NextResponse.json({ error: "ticketId, rca_id and confirmed_by are required" }, { status: 400 });
    }
  const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticketId)}/root-cause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(raw),
    signal: AbortSignal.timeout(30000),
  });
  return forceDecryptResponse(res);
}
