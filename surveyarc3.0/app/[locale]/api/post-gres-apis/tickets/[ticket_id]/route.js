// app/api/post-gres-apis/tickets/[ticket_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET one ticket
export async function GET(_req, { params }) {
  const { ticket_id } =  await params;
  try {
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH update
export async function PATCH(req, { params }) {
  const { ticket_id } = await params;
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}`, {
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

// DELETE
export async function DELETE(_req, { params }) {
  const { ticket_id } = params;
  try {
    const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticket_id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (res.status === 204) return NextResponse.json({}, { status: 204 });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
