import { NextResponse } from "next/server";

const BASE_URL = "http://localhost:8000" || "http://fastapi-backend:8000";

// Get single project
export async function GET(req, { params }) {
  const { orgId, projectId } = params;
  const res = await fetch(`${BASE_URL}/projects/${orgId}/${projectId}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

// Delete project
export async function DELETE(req, { params }) {
  const { orgId, projectId } = params;
  const res = await fetch(`${BASE_URL}/projects/${orgId}/${projectId}`, {
    method: "DELETE",
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
