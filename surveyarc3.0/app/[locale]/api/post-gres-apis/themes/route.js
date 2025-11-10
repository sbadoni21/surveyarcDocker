// app/api/post-gres-apis/themes/route.js
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

/*
  GET /api/post-gres-apis/themes?org_id=xxx&is_active=true&search=Dark&skip=0&limit=100
*/
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");
    const userId = searchParams.get("user_id");
    const isActive = searchParams.get("is_active");
    const search = searchParams.get("search");
    const skip = searchParams.get("skip") || "0";
    const limit = searchParams.get("limit") || "100";

    const params = new URLSearchParams();
    if (orgId) params.append("org_id", orgId);
    if (isActive !== null) params.append("is_active", isActive);
    if (search) params.append("search", search);
    params.append("skip", skip);
    params.append("limit", limit);

    const url = `${BASE}/themes?${params.toString()}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: {
        "X-User-Id": userId,
      },
    });

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/*
  POST /api/post-gres-apis/themes
*/
export async function POST(req) {
  try {
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    const url = `${BASE}/themes?org_id=${encodeURIComponent(body.org_id)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": body.created_by,
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

/*
  PUT /api/post-gres-apis/themes
  Body must include: theme_id
*/
export async function PUT(req) {
  try {
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    if (!body.theme_id) {
      return NextResponse.json(
        { status: "error", message: "Missing theme_id" },
        { status: 400 }
      );
    }

    const url = `${BASE}/themes/${encodeURIComponent(body.theme_id)}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": body.updated_by,
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

/*
  DELETE /api/post-gres-apis/themes?theme_id=xxx&org_id=yyy
  Soft delete → is_active = false
*/
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const themeId = searchParams.get("theme_id");

    if (!themeId) {
      return NextResponse.json(
        { status: "error", message: "Missing theme_id" },
        { status: 400 }
      );
    }

    const url = `${BASE}/themes/${encodeURIComponent(themeId)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-User-Id": userId,
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
