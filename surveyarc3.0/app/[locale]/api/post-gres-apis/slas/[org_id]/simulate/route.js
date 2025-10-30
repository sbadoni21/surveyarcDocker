// app/api/post-gres-apis/slas/[org_id]/simulate/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const txt = await res.text();
  try {
    const json = JSON.parse(txt);
    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) =>
            item && typeof item === "object"
              ? (await decryptGetResponse(item).catch(() => item))
              : item
          )
        );
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: txt }, { status: res.status });
  }
}

export async function POST(req, { params }) {
  const { org_id } = await params;
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/slas/${encodeURIComponent(org_id)}/simulate`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        ...(ENC ? { "x-encrypted": "1" } : {}) 
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}