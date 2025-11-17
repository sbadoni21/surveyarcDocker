// app/api/post-gres-apis/contact-lists/[listId]/contacts/route.js

import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RESPONSES === "1";

const looksEnvelope = (o) =>
  o && typeof o === "object" && "key_id" in o && "encrypted_key" in o && 
  "ciphertext" in o && "iv" in o && "tag" in o;

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
  
  if (!parsed.ok) {
    return NextResponse.json(
      { status: "error", raw: parsed.raw }, 
      { status: res.status }
    );
  }
  
  if (Array.isArray(parsed.json)) {
    const out = await Promise.all(
      parsed.json.map(async (item) => 
        looksEnvelope(item) ? await decryptGetResponse(item) : item
      )
    );
    return NextResponse.json(out, { status: res.status });
  }
  
  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }
  
  return NextResponse.json(parsed.json, { status: res.status });
}

// ✅ DELETE /api/post-gres-apis/contact-lists/[listId]/contacts
export async function DELETE(req, { params }) {
  const { listId } = await params;
  
  try {
    // ✅ Read the request body with contact_ids
    const body = await req.json();
    
    console.log(`Removing contacts from list: ${listId}`, body);
    
    // ✅ Encrypt payload if needed
    const payload = ENC ? await encryptPayload(body) : body;
    
    // ✅ Send DELETE request WITH body to FastAPI
    const res = await fetch(`${BASE}/contact-lists/${encodeURIComponent(listId)}/contacts`, {
      method: "DELETE",
      headers: { 
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    
    return forceDecryptResponse(res);
    
  } catch (error) {
    console.error("Error removing contacts from list:", error);
    return NextResponse.json(
      { status: "error", message: error.message }, 
      { status: 500 }
    );
  }
}