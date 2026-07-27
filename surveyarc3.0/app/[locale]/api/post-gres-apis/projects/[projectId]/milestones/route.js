import { NextResponse } from "next/server";
import { BASE, ENC, forceDecryptResponse } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";
export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const userId = searchParams.get("userId") ; // ✅ ADDED
  
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones`, {
    signal: AbortSignal.timeout(30000), 
    cache: "no-store",
    headers: { "x-user-id": userId } // ✅ ADDED
  });
  
  return forceDecryptResponse(res);
}

export async function POST(req, { params }) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { orgId, user_id, ...milestone } = body; // ✅ EXTRACT user_id
  const userId = user_id ;
  
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: JSON.stringify(milestone),
    signal: AbortSignal.timeout(30000), 
    cache: "no-store",
  });
  
  return forceDecryptResponse(res);
}