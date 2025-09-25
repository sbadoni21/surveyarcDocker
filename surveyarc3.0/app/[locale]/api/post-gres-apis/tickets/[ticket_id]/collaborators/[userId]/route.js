import { NextResponse } from "next/server";
const BASE = "http://localhost:8000";

export async function DELETE(_req, { params }) {
  const { ticketId, userId } = params;
  try {
    const res = await fetch(
      `${BASE}/tickets/${encodeURIComponent(ticketId)}/collaborators/${encodeURIComponent(userId)}`,
      { method: "DELETE", signal: AbortSignal.timeout(30000) }
    );
    const body = await res.text();
    if (res.status === 204) return NextResponse.json({ ok: true }, { status: 204 });
    let data; try { data = JSON.parse(body); } catch { data = { error: body } }
    return NextResponse.json(data, { status: res.status || 502 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 });
  }
}
