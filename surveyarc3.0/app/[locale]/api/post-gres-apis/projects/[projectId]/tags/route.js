import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";


// ============================================
// 10. tags/route.js - NEEDS FIX
// ============================================
// ISSUE: userId from params but should be from body
export async function PATCH(req, { params }) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { orgId, user_id, add = [], remove = [] } = body; // ✅ EXTRACT user_id
  const userId = user_id ;
  
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/tags`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: JSON.stringify({ add, remove }),
    signal: AbortSignal.timeout(30000), 
    cache: "no-store",
  });
  
  return forceDecryptResponse(res);
}