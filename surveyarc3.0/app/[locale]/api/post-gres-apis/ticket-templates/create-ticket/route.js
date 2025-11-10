

// app/api/post-gres-apis/ticket-templates/create-ticket/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RULES === "1";

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
  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }
  return NextResponse.json(parsed.json, { status: res.status });
}
export async function POST(req) {
  try {
    const body = await req.json();
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return NextResponse.json(
        { status: "error", message: "X-API-Key header is required" },
        { status: 401 }
      );
    }
    console.log("🔍 Headers:", { "X-API-Key": apiKey });
    const payload = ENC ? await encryptPayload(body) : body;
    
    const res = await fetch(`${BASE}/ticket-templates/create-ticket`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "X-API-Key": apiKey,
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}