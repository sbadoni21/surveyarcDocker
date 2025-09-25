import { NextResponse } from "next/server";

const BASE = "http://localhost:8000";

export async function GET(_req, { params }) {
  const { ticketId } = params;
  try {
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticketId)}/collaborators`, {
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text || []; }
    return NextResponse.json(data, { status: res.status || 502 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch collaborators" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { ticketId } = params;
  try {
    const body = await req.json();
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticketId)}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: false, error: text } }
    return NextResponse.json(data, { status: res.status || 502 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to add collaborator" }, { status: 500 });
  }
}
