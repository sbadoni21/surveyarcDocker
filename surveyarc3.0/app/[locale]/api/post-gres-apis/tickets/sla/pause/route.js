import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecrypt(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    try { const dec = await decryptGetResponse(json); return NextResponse.json(dec, { status: res.status }); }
    catch { return NextResponse.json(json, { status: res.status }); }
  } catch { return NextResponse.json({ raw: text }, { status: res.status }); }
}

export async function POST(req, { params }) {
  const { ticketId } = params;
  const body = await req.json();
  const payload = ENC ? await encryptPayload(body) : body;

  const res = await fetch(`${BASE}/tickets/${encodeURIComponent(ticketId)}/sla/pause`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  return forceDecrypt(res);
}
