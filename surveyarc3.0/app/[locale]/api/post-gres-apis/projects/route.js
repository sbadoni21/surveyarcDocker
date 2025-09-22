import { NextResponse } from "next/server";

const BASE_URL = "http://localhost:8000" || "http://fastapi-backend:8000";

// Create Project
export async function POST(req) {
  const body = await req.json();
  console.log(body)
  const res = await fetch(`${BASE_URL}/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

// Get all projects by orgId
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ message: "orgId is required" }, { status: 400 });
  }

  const res = await fetch(`${BASE_URL}/projects/${orgId}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

// Update project
export async function PATCH(req) {
  const body = await req.json();
  const { orgId, projectId, ...rest } = body;

  if (!orgId || !projectId) {
    return NextResponse.json({ message: "orgId and projectId are required" }, { status: 400 });
  }

  const res = await fetch(`${BASE_URL}/projects/${orgId}/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rest),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
