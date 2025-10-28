import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

export async function POST(req, { params }) {
  const { projectId } =  await params;
  const { orgId } = await req.json().catch(() => ({}));
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/progress/recompute`, {
    method: "POST",
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });

  return forceDecryptResponse(res);
}
