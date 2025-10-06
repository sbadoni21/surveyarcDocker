import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

const normId = (v) => (typeof v === "string" ? v.trim() : v);
const toUid = (m) => (m && typeof m === "object" ? normId(m.uid || m.user_id || m.id || null) : null);
const withUidShape = (m) => {
  if (!m || typeof m !== "object") return m;
  const uid = toUid(m);
  if (!uid) return m;
  const { user_id, id, ...rest } = m;
  return { uid, ...rest };
};

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

// GET single member (normalized)
export async function GET(req, { params }) {
  const { projectId, memberUid } = params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}?use_cache=false`, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const { status, json } = await jsonOrError(res);
  if (status >= 400) return NextResponse.json(json, { status });

  const members = Array.isArray(json.members) ? json.members : [];
  const m = members.map(withUidShape).find((x) => x.uid === memberUid);
  if (!m) return NextResponse.json({ detail: "Member not found" }, { status: 404 });
  return NextResponse.json(m, { status: 200 });
}

// PATCH upsert updates for a single member (merge only)
export async function PATCH(req, { params }) {
  const { projectId, memberUid } = params;
  const raw = await req.json().catch(() => ({}));
  const { orgId, ...memberUpdate } = raw;
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const getRes = await fetch(`${BASE}/projects/${orgId}/${projectId}?use_cache=false`, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const getPayload = await jsonOrError(getRes);
  if (!getPayload.ok) return NextResponse.json(getPayload.json, { status: getPayload.status });

  const existing = Array.isArray(getPayload.json.members) ? getPayload.json.members.map(withUidShape) : [];
  const idx = existing.findIndex((m) => m.uid === memberUid);
  if (idx === -1) return NextResponse.json({ detail: "Member not found" }, { status: 404 });

  const merged = [...existing];
  merged[idx] = { ...merged[idx], ...memberUpdate, uid: memberUid };

  const payload = ENC ? await encryptPayload({ members: merged }) : { members: merged };
  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  return forceDecryptResponse(res);
}

// DELETE one member (preserve others)
export async function DELETE(req, { params }) {
  const { projectId, memberUid } = params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const getRes = await fetch(`${BASE}/projects/${orgId}/${projectId}?use_cache=false`, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const getPayload = await jsonOrError(getRes);
  if (!getPayload.ok) return NextResponse.json(getPayload.json, { status: getPayload.status });

  const existing = Array.isArray(getPayload.json.members) ? getPayload.json.members.map(withUidShape) : [];
  const filtered = existing.filter((m) => m.uid !== memberUid);

  const payload = ENC ? await encryptPayload({ members: filtered }) : { members: filtered };
  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });

  return forceDecryptResponse(res);
}
