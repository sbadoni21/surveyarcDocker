import { NextResponse } from "next/server";
import { BASE, jsonOrError } from "@/utils/categoryApiHelpers";


// ============================================
// 14. org/[orgId]/search/route.js - NEEDS FIX
// ============================================
// ISSUE: Missing userId
export async function POST(req, { params }) {
  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));
  const userId = body.user_id ; // ✅ EXTRACT user_id

  const res = await fetch(`${BASE}/projects/${orgId}/search`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-user-id": userId // ✅ ADDED
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000), 
    cache: "no-store",
  });
  
  const { status, json } = await jsonOrError(res);
  return NextResponse.json(json, { status });
}