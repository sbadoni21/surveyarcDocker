import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC  = process.env.ENCRYPT_SUPPORT === "1";

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
  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }
  try {
    const res = await fetch(`${BASE}/support-groups?org_id=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch support groups", detail: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const raw = await req.json(); // { org_id, name, email?, description? , group_id? }
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/support-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to create support group", detail: String(e?.message || e) }, { status: 500 });
  }
}
