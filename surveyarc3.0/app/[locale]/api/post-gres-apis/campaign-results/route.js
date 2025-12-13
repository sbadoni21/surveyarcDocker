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

// GET /api/post-gres-apis/campaign-results?campaign_id=xxx
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaign_id");
    const status = searchParams.get("status");
    const channel = searchParams.get("channel");
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("page_size") || "50";
    const userId = searchParams.get("user_id");

    if (!campaignId) {
      return NextResponse.json(
        { status: "error", message: "Missing campaign_id" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      campaign_id: campaignId,
      page,
      page_size: pageSize,
    });

    if (status) params.append("status", status);
    if (channel) params.append("channel", channel);

    const url = `${BASE}/campaign-results?${params.toString()}`;

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

// POST /api/post-gres-apis/campaign-results
export async function POST(req) {
  try {
    const body = await req.json();

    if (!body.campaign_id || !body.contact_id) {
      return NextResponse.json(
        { status: "error", message: "Missing campaign_id or contact_id" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;
    const url = `${BASE}/campaign-results/`;

    const res = await fetch(url, {
      method: "POST",
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