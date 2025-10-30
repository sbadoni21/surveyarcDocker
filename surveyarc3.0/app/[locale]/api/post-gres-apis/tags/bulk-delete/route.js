// app/api/post-gres-apis/tags/bulk-delete/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

export async function DELETE(req) {
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;
    
    const res = await fetch(`${BASE}/tags/bulk-delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}