// app/api/post-gres-apis/projects/route.js
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

// GET /api/post-gres-apis/projects?orgId=...
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const userId = searchParams.get("userId") || searchParams.get("user_id");
  
  console.log("Next.js API - orgId:", orgId, "userId:", userId);
  
  if (!orgId) {
    return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
  }

  const qs = new URLSearchParams();
  const useCache = searchParams.get("use_cache");
  if (useCache) qs.set("use_cache", useCache);
  
  // ✅ ADD orgId to the query string for FastAPI
  qs.set("orgId", orgId);

  try {
    const url = `${BASE}/projects/${orgId}?${qs.toString()}`;
    console.log("Calling FastAPI:", url);
    
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 
        "x-user-id": userId,
      },
      cache: "no-store",
    });
    
    console.log("FastAPI response status:", res.status);
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Error calling FastAPI:", e);
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
// POST /api/post-gres-apis/projects
export async function POST(req) {
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;
    const userId = raw.ownerUID || raw.userId || raw.owner_uid;
    console.log(raw, payload, userId);

    const res = await fetch(`${BASE}/projects/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId, ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}