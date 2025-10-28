import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

export async function GET(_req, { params }) {
  const { orgId, userId } = await params;
  const res = await fetch(`${BASE}/projects/${orgId}/favorites/${userId}`, {
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  
  return forceDecryptResponse(res);
}

export async function POST(_req, { params }) {
  const { orgId, userId, projectId } =await params;
  const res = await fetch(`${BASE}/projects/${orgId}/favorites/${userId}/${projectId}`, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  return forceDecryptResponse(res);
}

// Remove favorite
export async function DELETE(_req, { params }) {
  const { orgId, userId, projectId } =await params;
  const res = await fetch(`${BASE}/projects/${orgId}/favorites/${userId}/${projectId}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  return forceDecryptResponse(res);

}
