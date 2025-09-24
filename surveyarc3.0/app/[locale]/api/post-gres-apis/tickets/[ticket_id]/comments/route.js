import { NextResponse } from "next/server";
const BASE =  "http://fastapi-backend:8000"|| "http://localhost:8000" ;

export async function POST(req, { params }) {
  const { ticket_id } = params;
  const body = await req.json(); // { uid, comment }
  const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
