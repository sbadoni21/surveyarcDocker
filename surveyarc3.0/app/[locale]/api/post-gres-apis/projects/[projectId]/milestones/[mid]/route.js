import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
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
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
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
export async function PATCH(req, { params }) {
  const { projectId, mid } = await params;
  const { orgId, ...patch } = await req.json().catch(() => ({}));
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones/${mid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
 
  return forceDecryptResponse(res);
}

export async function DELETE(req, { params }) {
  const { projectId, mid } = await params;
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ detail: "orgId is required" }, { status: 400 });

  const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/milestones/${mid}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(30000), cache: "no-store",
  });
  return forceDecryptResponse(res);
}
