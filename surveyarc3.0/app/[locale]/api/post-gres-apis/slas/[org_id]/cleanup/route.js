// app/api/post-gres-apis/slas/objectives/[objective_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
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

export async function GET(_req, { params }) {
  const { objective_id } = await params;
  try {
    const res = await fetch(`${BASE}/slas/objectives/${encodeURIComponent(objective_id)}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { objective_id } = await params;
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/slas/objectives/${encodeURIComponent(objective_id)}`, {
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

export async function DELETE(_req, { params }) {
  const { objective_id } = await params;
  try {
    const res = await fetch(`${BASE}/slas/objectives/${encodeURIComponent(objective_id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
