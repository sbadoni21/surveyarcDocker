import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
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

// GET /support-groups/:groupId/members
export async function GET(_req, { params }) {
  const { groupId } = await params;
  try {
    const res = await fetch(`${BASE}/support-groups/${encodeURIComponent(groupId)}/members`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch group members", detail: String(e?.message || e) }, { status: 500 });
  }
}

// POST /support-groups/:groupId/members  (add member)
// body: { user_id, role?, proficiency? }
export async function POST(req, { params }) {
  const { groupId } = await params;
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/support-groups/${encodeURIComponent(groupId)}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to add member", detail: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH /support-groups/:groupId/members?user_id=...  (update one member)
// body: { role?, proficiency?, active? }
export async function PATCH(req, { params }) {
  const { groupId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(
      `${BASE}/support-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update member", detail: String(e?.message || e) }, { status: 500 });
  }
}

// DELETE /support-groups/:groupId/members?user_id=...
export async function DELETE(req, { params }) {
  const { groupId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${BASE}/support-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE", signal: AbortSignal.timeout(30000) }
    );
    return NextResponse.json({}, { status: res.status || 204 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to remove member", detail: String(e?.message || e) }, { status: 500 });
  }
}
