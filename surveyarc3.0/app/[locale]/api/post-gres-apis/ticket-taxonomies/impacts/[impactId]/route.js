import { NextResponse } from "next/server";
import { forceDecryptResponse, BASE, ENC } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(_req, { params }) {
  const { impactId } = params;
  const res = await fetch(`${BASE}/ticket-taxonomies/impacts/${encodeURIComponent(impactId)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  return forceDecryptResponse(res);
}

export async function PATCH(req, { params }) {
  const { impactId } = await params;
  const raw = await req.json();
  const payload = ENC ? await encryptPayload(raw) : raw;

  const res = await fetch(`${BASE}/ticket-taxonomies/impacts/${encodeURIComponent(impactId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  return forceDecryptResponse(res);
}

export async function DELETE(_req, { params }) {
  const { impactId } = await params;
  const res = await fetch(`${BASE}/ticket-taxonomies/impacts/${encodeURIComponent(impactId)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  return forceDecryptResponse(res);
}
