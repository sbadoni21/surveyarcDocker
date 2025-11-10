// app/api/post-gres-apis/ticket-templates/route.js
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

// GET /api/post-gres-apis/ticket-templates?org_id=xxx&is_active=true&search=...
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");
    const userId = searchParams.get("user_id");
    const isActive = searchParams.get("is_active");
    const search = searchParams.get("search");
    const skip = searchParams.get("skip") || "0";
    const limit = searchParams.get("limit") || "100";
    
    let url = `${BASE}/ticket-templates/templates?`;
    const params = new URLSearchParams();
    
    if (orgId) params.append("org_id", orgId);
    if (isActive !== null) params.append("is_active", isActive);
    if (search) params.append("search", search);
    params.append("skip", skip);
    params.append("limit", limit);
    
    url += params.toString();

    const res = await fetch(url, {
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

// POST /api/post-gres-apis/ticket-templates - Create new template
export async function POST(req) {

  try {
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;
console.log(payload)
    const url = `${BASE}/ticket-templates/templates?org_id=${encodeURIComponent(body.org_id)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "X-User-Id": body.user_id,
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
