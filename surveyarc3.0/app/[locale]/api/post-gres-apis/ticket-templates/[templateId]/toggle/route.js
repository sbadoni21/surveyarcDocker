
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

export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const templateId = params.template_id;
    
    const res = await fetch(`${BASE}/ticket-templates/templates/${templateId}`, {
      signal: AbortSignal.timeout(30000),
      headers: {
        "X-User-Id": userId,
      },
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH /api/post-gres-apis/ticket-templates/[template_id]
export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;
    const templateId = params.template_id;
    
    const res = await fetch(`${BASE}/ticket-templates/templates/${templateId}`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json", 
        "X-User-Id": body.userId,
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

// DELETE /api/post-gres-apis/ticket-templates/[template_id]
export async function DELETE(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const templateId = params.template_id;
    
    const res = await fetch(`${BASE}/ticket-templates/templates/${templateId}`, {
      method: "DELETE",
      headers: {
        "X-User-Id": userId,
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}
