import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RULES === "1";

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

// GET /api/post-gres-apis/campaigns/[campaign_id]
export async function GET(req, { params }) {
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

    const url = `${BASE}/campaigns/${encodeURIComponent(campaign_id)}`;

    const res = await fetch(url, {
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

// PATCH /api/post-gres-apis/campaigns/[campaign_id]
export async function PATCH(req, { params }) {
  try {
    const { campaign_id } = await params;
    const body = await req.json();

    if (!campaign_id) {
      return NextResponse.json(
        { status: "error", message: "Missing campaign_id" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;
    const url = `${BASE}/campaigns/${encodeURIComponent(campaign_id)}`;

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": body.user_id || "",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
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

// DELETE /api/post-gres-apis/campaigns/[campaign_id]
export async function DELETE(req, { params }) {
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

    const url = `${BASE}/campaigns/${encodeURIComponent(campaign_id)}`;

    const res = await fetch(url, {
      method: "DELETE",
  
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}