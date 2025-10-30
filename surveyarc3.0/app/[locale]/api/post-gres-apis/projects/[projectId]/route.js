// app/api/post-gres-apis/projects/[projectId]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) => {
            if (item && typeof item === "object") {
              try { return await decryptGetResponse(item); } catch { return item; }
            }
            return item;
          })
        );
        return NextResponse.json(dec, { status: res.status });
      } catch { return NextResponse.json(json, { status: res.status }); }
    }
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/projects/[projectId]?orgId=...
export async function GET(req, { params }) {
  const { projectId } =  await params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  
  if (!orgId) {
    return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
  }

  const qs = new URLSearchParams();
  const useCache = searchParams.get("use_cache");
  if (useCache) qs.set("use_cache", useCache);

  try {
    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}?${qs.toString()}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH /api/post-gres-apis/projects/[projectId]
export async function PATCH(req, { params }) {
  const { projectId } =  await params;
  
  try {
    const raw = await req.json();
    const { orgId, ...updateData } = raw;

    if (!orgId) {
      return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
    }

    const payload = ENC ? await encryptPayload(updateData) : updateData;

    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

// DELETE /api/post-gres-apis/projects/[projectId]?orgId=...
export async function DELETE(req, { params }) {
  const { projectId } =  await params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  console.log(projectId, orgId)
  if (!orgId) {
    return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}