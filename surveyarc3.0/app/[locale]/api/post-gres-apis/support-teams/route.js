// app/api/post-gres-apis/support-teams/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SUPPORT === "1";

/** Decrypt-if-needed helper (array/object/primitive safe) */
async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);

    // try decrypt object
    if (json && typeof json === "object" && !Array.isArray(json)) {
      try {
        const dec = await decryptGetResponse(json);
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    // try decrypt each array item
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

    // primitive
    return NextResponse.json(json, { status: res.status });
  } catch {
    // not JSON
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  const groupId = searchParams.get("group_id");
  
  if (!orgId && !groupId) {
    return NextResponse.json({ error: "Either org_id or group_id is required" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams();
    if (orgId) params.set("org_id", orgId);
    if (groupId) params.set("group_id", groupId);

    const res = await fetch(`${BASE}/support-teams?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      error: "Failed to fetch support teams", 
      detail: String(e?.message || e) 
    }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const raw = await req.json(); // { org_id, group_id, name, description?, email?, target_proficiency?, routing_weight?, default_sla_id?, meta? }
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/support-teams`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ 
      error: "Failed to create support team", 
      detail: String(e?.message || e) 
    }, { status: 500 });
  }
}
