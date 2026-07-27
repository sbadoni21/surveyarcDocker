import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";
export async function POST(req, { params }) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { orgId, user_id } = body; // ✅ EXTRACT user_id
  const userId = user_id ;
  
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/progress/recompute`, {
    method: "POST",
    headers: { "x-user-id": userId },
    signal: AbortSignal.timeout(30000), 
    cache: "no-store",
  });

  return forceDecryptResponse(res);
}
