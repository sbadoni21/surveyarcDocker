import { NextResponse } from "next/server";
const BASE = "http://localhost:8000" || "http://fastapi-backend:8000";

export async function GET(_req, { params }) {
  const { ticket_id } = params;
  const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req, { params }) {
  const { ticket_id } = params;
  const body = await req.json();
  const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(_req, { params }) {
  const { ticket_id } = params;
  const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
