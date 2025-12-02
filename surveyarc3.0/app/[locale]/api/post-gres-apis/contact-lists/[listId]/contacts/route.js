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

// PATCH /api/post-gres-apis/contact-lists/[listId]/contacts
// Add contacts to a list
export async function PATCH(req, { params }) {
  const { listId } = await params;

  try {
    const body = await req.json();
    
    // ✅ Ensure contact_ids is present
    if (!body.contact_ids || !Array.isArray(body.contact_ids)) {
      return NextResponse.json(
        { status: "error", message: "contact_ids array is required" }, 
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;
    
    const res = await fetch(`${BASE}/contact-lists/${encodeURIComponent(listId)}/contacts`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    
    return ENC ? forceDecryptResponse(res) : NextResponse.json(await res.json(), { status: res.status });
  } catch (error) {
    console.error("Error adding contacts to list:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}

// DELETE /api/post-gres-apis/contact-lists/[listId]/contacts
// Remove contacts from a list
export async function DELETE(req, { params }) {
  const { listId } = await params;

  try {
    const body = await req.json();
    
    // ✅ Ensure contact_ids is present and properly formatted
    if (!body.contact_ids || !Array.isArray(body.contact_ids)) {
      return NextResponse.json(
        { status: "error", message: "contact_ids array is required" }, 
        { status: 400 }
      );
    }

    // ✅ Flatten if double-wrapped and ensure all are strings
    let contactIds = body.contact_ids;
    if (contactIds.length === 1 && Array.isArray(contactIds[0])) {
      contactIds = contactIds[0];
    }
    contactIds = contactIds.filter(id => typeof id === 'string');

    console.log("🗑️ DELETE request - listId:", listId, "contact_ids:", contactIds);

    const cleanBody = { contact_ids: contactIds };
    const payload = ENC ? await encryptPayload(cleanBody) : cleanBody;
    
    const res = await fetch(`${BASE}/contact-lists/${encodeURIComponent(listId)}/contacts`, {
      method: "DELETE",
      headers: { 
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Backend error:", res.status, errorText);
      return NextResponse.json(
        { status: "error", message: errorText }, 
        { status: res.status }
      );
    }
    
    return ENC ? forceDecryptResponse(res) : NextResponse.json(await res.json(), { status: res.status });
  } catch (error) {
    console.error("❌ Error removing contacts from list:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}