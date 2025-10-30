import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RESPONSES === "1";

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

// POST /api/contact-lists/[listId]/contacts - Add contacts to list
export async function POST(req, { params }) {
  try {
    const { listId } = await params;
    const body = await req.json();
    const payload = await encryptPayload(body);

    console.log("Adding contacts to list:", listId, body);

    const res = await fetch(`${BASE}/contact-lists/${listId}/contacts`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    
    return forceDecryptResponse(res);
  } catch (error) {
    console.error("Error adding contacts to list:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}

// DELETE /api/contact-lists/[listId]/contacts - Remove contacts from list
export async function DELETE(req, { params }) {
  try {
    const { listId } = await params;
    const body = await req.json();
    const payload = await encryptPayload(body);

    console.log("Removing contacts from list:", listId, body);

    const res = await fetch(`${BASE}/contact-lists/${listId}/contacts`, {
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
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}