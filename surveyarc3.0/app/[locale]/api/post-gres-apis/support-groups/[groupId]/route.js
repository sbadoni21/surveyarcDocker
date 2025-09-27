import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC  = process.env.ENCRYPT_SUPPORT === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    if (Array.isArray(json)) {
      const dec = await Promise.all(json.map(async (i) => {
        if (i && typeof i === "object") { try { return await decryptGetResponse(i); } catch { return i; } }
        return i;
      }));
      return NextResponse.json(dec, { status: res.status });
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}

export async function GET(_req, { params }) {
  const { groupId } = await params;
  try {
    const res = await fetch(`${BASE}/support-groups/${encodeURIComponent(groupId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch group", detail: String(e?.message || e) }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { groupId } = await params;

  try {
    const raw = await req.json(); // { name?, email?, description?, active? ... }
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/support-groups/${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update group", detail: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { groupId } = await params;
  try {
    const res = await fetch(`${BASE}/support-groups/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
    });
    // delete returns probably 204; just echo status
    return NextResponse.json({}, { status: res.status || 204 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete group", detail: String(e?.message || e) }, { status: 500 });
  }
}
