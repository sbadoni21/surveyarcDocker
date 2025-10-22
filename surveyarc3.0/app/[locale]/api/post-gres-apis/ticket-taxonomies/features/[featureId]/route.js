import { NextResponse } from "next/server";
import { forceDecryptResponse, BASE, ENC } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(_req, { params }) {
  const { featureId } = await params;
  const res = await fetch(`${BASE}/ticket-taxonomies/features/${encodeURIComponent(featureId)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  return forceDecryptResponse(res);
}

export async function PATCH(req, { params }) {
  const { featureId } = await params;
  const raw = await req.json();
  const payload = ENC ? await encryptPayload(raw) : raw;

  const res = await fetch(`${BASE}/ticket-taxonomies/features/${encodeURIComponent(featureId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  return forceDecryptResponse(res);
}

export async function DELETE(_req, { params }) {
  const { featureId } = await params;
  const res = await fetch(`${BASE}/ticket-taxonomies/features/${encodeURIComponent(featureId)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  return forceDecryptResponse(res);
}
