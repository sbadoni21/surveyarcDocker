// app/api/post-gres-apis/slas/[sla_id]/objectives/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const txt = await res.text();
  try {
    const json = JSON.parse(txt);
    if (Array.isArray(json)) return NextResponse.json(json, { status: res.status }); // items are primitive-ish
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: txt }, { status: res.status });
  }
}

export async function GET(_req, { params }) {
  const { sla_id } = await params;
  try {
    const res = await fetch(`${BASE}/slas/${encodeURIComponent(sla_id)}/objectives`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { sla_id } = await params;
  try {
    const raw = await req.json();
    console.log(raw)
    const payload = ENC ? await encryptPayload({ ...raw, sla_id }) : { ...raw, sla_id };

    const res = await fetch(`${BASE}/slas/${encodeURIComponent(sla_id)}/objectives`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
