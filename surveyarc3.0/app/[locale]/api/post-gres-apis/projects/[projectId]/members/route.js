import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

// ---------- helpers ----------
async function jsonOrError(res) {
  const txt = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(txt) };
  } catch {
    return { ok: res.ok, status: res.status, json: { raw: txt } };
  }
}

async function forceDecryptResponse(res) {
  const { ok, status, json } = await jsonOrError(res);
  if (!ok) return NextResponse.json(json, { status });
  try {
    return NextResponse.json(await decryptGetResponse(json), { status });
  } catch {
    return NextResponse.json(json, { status });
  }
}

// GET /api/post-gres-apis/projects/[projectId]/members?orgId=...
export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  // ✔ Use the members endpoint (returns the actual array)
  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/members`, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const { status, json } = await jsonOrError(res);
  return NextResponse.json(json, { status });
}

// POST /api/post-gres-apis/projects/[projectId]/members
// Body: { orgId, uid, role, email, status, joined_at, ... }
export async function POST(req, { params }) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { orgId, ...memberData } = body;
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  // ✔ Let the backend do the upsert (no full-array PATCH)
  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(memberData),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  return forceDecryptResponse(res);
}
