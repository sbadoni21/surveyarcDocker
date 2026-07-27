import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

export async function GET(_req, { params }) {
  const { orgId, userId } = await params;
  const res = await fetch(`${BASE}/projects/${orgId}/favorites/${userId}`, {
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  
  return forceDecryptResponse(res);
}
