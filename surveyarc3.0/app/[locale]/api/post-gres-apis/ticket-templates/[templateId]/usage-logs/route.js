

// app/api/post-gres-apis/ticket-templates/[templateId]/stats/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

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
  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }
  return NextResponse.json(parsed.json, { status: res.status });
}
// app/api/post-gres-apis/ticket-templates/[template_id]/usage-logs/route.js
export async function GET(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const templateId = params.template_id;
    const success = searchParams.get("success");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const skip = searchParams.get("skip") || "0";
    const limit = searchParams.get("limit") || "100";
    
    let url = `${BASE}/ticket-templates/templates/${templateId}/usage-logs?`;
    const params = new URLSearchParams();
    
    if (success !== null) params.append("success", success);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
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