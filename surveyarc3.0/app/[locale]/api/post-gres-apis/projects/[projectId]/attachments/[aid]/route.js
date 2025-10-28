import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

export async function DELETE(req, { params }) {
  const { projectId, aid } = await params;
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/attachments/${aid}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
 
  return forceDecryptResponse(res);
}
