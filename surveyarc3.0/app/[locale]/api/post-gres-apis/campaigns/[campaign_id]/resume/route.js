import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

const looksEnvelope = (o) =>
  o &&
  typeof o === "object" &&
  "key_id" in o &&
  "encrypted_key" in o &&
  "ciphertext" in o &&
  "iv" in o &&
  "tag" in o;

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
  if (!parsed.ok)
    return NextResponse.json(
      { status: "error", raw: parsed.raw },
      { status: res.status }
    );
  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }
  return NextResponse.json(parsed.json, { status: res.status });
}

// POST /api/post-gres-apis/campaigns/[campaign_id]/resume
export async function POST(req, { params }) {
  try {
    const { campaign_id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!campaign_id) {
      return NextResponse.json(
        { status: "error", message: "Missing campaign_id" },
        { status: 400 }
      );
    }

    const url = `${BASE}/campaigns/${encodeURIComponent(campaign_id)}/resume`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-User-Id": userId || "",
      },
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}