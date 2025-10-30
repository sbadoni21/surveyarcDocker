import { decryptGetResponse } from "@/utils/crypto_client";
import { NextResponse } from "next/server";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;

const looksEnvelope = (o) =>
  o && typeof o === "object" && "key_id" in o && "encrypted_key" in o && "ciphertext" in o && "iv" in o && "tag" in o;

const safeParse = (t) => { 
  try { 
    return { ok: true, json: JSON.parse(t) }; 
  } catch { 
    return { ok: false, raw: t }; 
  } 
};

async function forceDecryptResponse(res) {
  const text = await res.text();
  const parsed = safeParse(text);
  if (!parsed.ok) return NextResponse.json({ status: "error", raw: parsed.raw }, { status: res.status });

  if (Array.isArray(parsed.json)) {
    const out = await Promise.all(
      parsed.json.map(async (item) => (looksEnvelope(item) ? await decryptGetResponse(item) : item))
    );
    return NextResponse.json(out, { status: res.status });
  }
  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }
  return NextResponse.json(parsed.json, { status: res.status });
}

// DELETE /api/post-gres-apis/contact-socials/[id]
export async function DELETE(req, { params }) {
  const { id } = params;

  try {
    const res = await fetch(`${BASE}/contact-socials/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}