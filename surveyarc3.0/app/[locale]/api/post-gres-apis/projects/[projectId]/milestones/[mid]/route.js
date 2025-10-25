import { NextResponse } from "next/server";
import { BASE, jsonOrError } from "@/app/api/post-gres-apis/_lib/http";

export async function PATCH(req, { params }) {
  const { projectId, mid } = await params;
  const { orgId, ...patch } = await req.json().catch(() => ({}));
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones/${mid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  const { status, json } = await jsonOrError(res);
  return NextResponse.json(json, { status });
}

export async function DELETE(req, { params }) {
  const { projectId, mid } = await params;
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones/${mid}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  const { status, json } = await jsonOrError(res);
  return NextResponse.json(json, { status });
}
