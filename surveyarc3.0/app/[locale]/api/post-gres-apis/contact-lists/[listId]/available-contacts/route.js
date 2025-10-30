import { decryptGetResponse } from "@/utils/crypto_client";
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

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

// GET /api/contact-lists/[listId]/available-contacts?org_id=xxx
export async function GET(req, { params }) {
  try {
    const { listId } = await params;
    const { searchParams } = new URL(req.url);
    const org_id = searchParams.get("org_id");
    
    if (!org_id) {
      return NextResponse.json({ status: "error", message: "org_id is required" }, { status: 400 });
    }

    console.log("Fetching available contacts for list:", listId, "org:", org_id);

    const res = await fetch(
      `${BASE}/contact-lists/${listId}/available-contacts?org_id=${org_id}`, 
      { signal: AbortSignal.timeout(30000) }
    );
    
    return forceDecryptResponse(res);
  } catch (error) {
    console.error("Error fetching available contacts:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}