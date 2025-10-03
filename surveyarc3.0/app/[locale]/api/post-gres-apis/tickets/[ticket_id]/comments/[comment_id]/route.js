import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

/** DELETE /api/post-gres-apis/tickets/:ticket_id/comments/:comment_id */
export async function DELETE(_req, { params }) {
  const { ticket_id, comment_id } = await params;
  try {
    const res = await fetch(
      `${BASE}/tickets/${encodeURIComponent(ticket_id)}/comments/${encodeURIComponent(comment_id)}`,
      { method: "DELETE" }
    );
    if (res.status === 204) return NextResponse.json({ ok: true }, { status: 200 });

    // Bubble up non-204 errors
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return NextResponse.json({ detail: text || "Delete failed" }, { status: res.status });
    }
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
