import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

// Body: { project_ids:[], op:"archive|unarchive|delete|set_priority|set_status", value? }
export async function POST(req, { params }) {
  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${BASE}/projects/${orgId}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
   return forceDecryptResponse(res);
 
}
