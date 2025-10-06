import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

// ---------- helpers ----------
const normId = (v) => (typeof v === "string" ? v.trim() : v);
const toUid = (m) => {
  if (!m || typeof m !== "object") return null;
  return normId(m.uid || m.user_id || m.id || null);
};
const withUidShape = (m) => {
  if (!m || typeof m !== "object") return m;
  const uid = toUid(m);
  if (!uid) return m;
  const { user_id, id, ...rest } = m;
  return { uid, ...rest };
};
const eqByUid = (a, b) => toUid(a) && toUid(a) === toUid(b);

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

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}?use_cache=false`, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const { status, json } = await jsonOrError(res);
  if (status >= 400) return NextResponse.json(json, { status });

  const current = Array.isArray(json.members) ? json.members : [];
  const normalized = current.map(withUidShape);
  return NextResponse.json(normalized, { status: 200 });
}

// POST /api/post-gres-apis/projects/[projectId]/members
// Body: { orgId, uid, role, email, status, joined_at, ... }
export async function POST(req, { params }) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { orgId, ...memberData } = body;
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  // 1) Fetch FRESH project (skip cache to avoid stale clobber)
  const getRes = await fetch(`${BASE}/projects/${orgId}/${projectId}?use_cache=false`, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const getPayload = await jsonOrError(getRes);
  if (!getPayload.ok) return NextResponse.json(getPayload.json, { status: getPayload.status });

  const current = Array.isArray(getPayload.json.members) ? getPayload.json.members : [];
  const existing = current.map(withUidShape);

  // 2) Upsert the member by uid (never drop others)
  const incoming = withUidShape(memberData);
  const uid = toUid(incoming);
  if (!uid) return NextResponse.json({ detail: "uid is required on member" }, { status: 400 });

  const idx = existing.findIndex((m) => toUid(m) === uid);
  let updatedMembers;
  if (idx >= 0) {
    updatedMembers = [...existing];
    updatedMembers[idx] = { ...updatedMembers[idx], ...incoming, uid };
  } else {
    const now = new Date().toISOString();
    updatedMembers = [...existing, { status: "active", joined_at: now, ...incoming, uid }];
  }

  // 3) Send full members array (merged) to backend
  const payload = ENC ? await encryptPayload({ members: updatedMembers }) : { members: updatedMembers };
  const patchRes = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  return forceDecryptResponse(patchRes);
}
