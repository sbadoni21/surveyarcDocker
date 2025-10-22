import { NextResponse } from "next/server";
import { forceDecryptResponse, BASE, ENC } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  const includeInactive = searchParams.get("include_inactive");

  if (!orgId) return NextResponse.json({ error: "org_id is required" }, { status: 400 });

  const qs = new URLSearchParams({ org_id: orgId });
  if (includeInactive) qs.set("include_inactive", "true");

  const res = await fetch(`${BASE}/ticket-taxonomies/root-causes?${qs}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  return forceDecryptResponse(res);
}

export async function POST(req) {
  const raw = await req.json();
  if (!raw?.name || !raw?.org_id) {
    return NextResponse.json({ error: "name and org_id are required" }, { status: 400 });
  }
  const payload = ENC ? await encryptPayload(raw) : raw;

  const res = await fetch(`${BASE}/ticket-taxonomies/root-causes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  return forceDecryptResponse(res);
}
