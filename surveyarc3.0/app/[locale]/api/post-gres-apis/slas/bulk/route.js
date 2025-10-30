// app/api/post-gres-apis/slas/bulk/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const txt = await res.text();
  try {
    const json = JSON.parse(txt);
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: txt }, { status: res.status });
  }
}

// POST /api/post-gres-apis/slas/bulk?update_existing=true
export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const update_existing = searchParams.get("update_existing");
  
  const qs = new URLSearchParams();
  if (update_existing !== null) qs.set("update_existing", update_existing);

  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/slas/bulk?${qs.toString()}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

// DELETE /api/post-gres-apis/slas/bulk?force=false
export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force");
  
  const qs = new URLSearchParams();
  if (force !== null) qs.set("force", force);

  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/slas/bulk?${qs.toString()}`, {
      method: "DELETE",
      headers: { 
        "Content-Type": "application/json", 
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}