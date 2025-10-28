import { NextResponse } from "next/server";
import { BASE, forceDecryptResponse } from "@/utils/categoryApiHelpers";

// Body: { q?, status?, priority?, tag?, is_active?, created_from?, created_to?, order_by?, limit?, offset? }
export async function POST(req, { params }) {
  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${BASE}/projects/${orgId}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
 
  return forceDecryptResponse(res);
}
