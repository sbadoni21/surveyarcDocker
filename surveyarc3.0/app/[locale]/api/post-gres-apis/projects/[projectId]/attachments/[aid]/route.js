import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

export async function DELETE(req, { params }) {
  const { projectId, aid } = await params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const userId = searchParams.get("userId") ; // ✅ FIXED
  
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/attachments/${aid}`, {
    method: "DELETE",
    headers: { "x-user-id": userId },
    signal: AbortSignal.timeout(30000), 
    cache: "no-store",
  });
 
  return forceDecryptResponse(res);
}