import { NextResponse } from "next/server";

const BASE_URL = "http://localhost:8000" || "http://fastapi-backend:8000";

export async function POST(req) {
  const body = await req.json();
  const res = await fetch(`${BASE_URL}/organisation/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const res = await fetch(`${BASE_URL}/organisation/${orgId}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req) {
  const body = await req.json();
  const { orgId, ...rest } = body;
  const res = await fetch(`${BASE_URL}/organisation/${orgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rest),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
