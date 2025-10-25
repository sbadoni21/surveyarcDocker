import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

export async function PATCH(req, { params }) {
  const { projectId } =  await params;
  const body = await req.json().catch(() => ({}));
  const { orgId, add = [], remove = [] } = body;
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/tags`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ add, remove }),
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  return forceDecryptResponse(res);
}
