import { NextResponse } from "next/server";
import { BASE, ENC, jsonOrError } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones`, {
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  const { status, json } = await jsonOrError(res);
  return NextResponse.json(json, { status });
}

export async function POST(req, { params }) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { orgId, ...milestone } = body;
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(milestone),
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  const { status, json } = await jsonOrError(res);
  return NextResponse.json(json, { status });
}
