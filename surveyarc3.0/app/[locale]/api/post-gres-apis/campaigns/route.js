// app/api/post-gres-apis/campaigns/route.js

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

// GET /api/post-gres-apis/campaigns
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("page_size") || "20";
    const status = searchParams.getAll("status");
    const channel = searchParams.getAll("channel");
    const surveyId = searchParams.get("survey_id");
    const search = searchParams.get("search");
    const userId = searchParams.get("user_id"); // ✅ Get userId from query

    const params = new URLSearchParams();
    params.append("page", page);
    params.append("page_size", pageSize);
    status.forEach(s => params.append("status", s));
    channel.forEach(c => params.append("channel", c));
    if (surveyId) params.append("survey_id", surveyId);
    if (search) params.append("search", search);

    const url = `${BASE}/campaigns/?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        "X-User-Id": userId || "", // ✅ Pass userId in header
      },
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (e) {
    console.error("❌ GET /api/post-gres-apis/campaigns error:", e);
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// POST /api/post-gres-apis/campaigns
export async function POST(req) {
  try {
    const body = await req.json();
        const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    const payload = ENC ? await encryptPayload(body) : body;

    const url = `${BASE}/campaigns/`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId || "", 
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Backend error:", res.status, errorText);
    }

    return forceDecryptResponse(res);
  } catch (e) {
    console.error("❌ POST /api/post-gres-apis/campaigns error:", e);
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}