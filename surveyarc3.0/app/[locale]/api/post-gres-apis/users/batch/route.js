// app/en/api/post-gres-apis/users/batch/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RESPONSES === "1";

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

  if (!parsed.ok) {
    return NextResponse.json(
      { status: "error", raw: parsed.raw },
      { status: res.status }
    );
  }

  const data = parsed.json;

  if (looksEnvelope(data)) {
    try {
      const dec = await decryptGetResponse(data);
      return NextResponse.json(dec, { status: res.status });
    } catch {
      return NextResponse.json(data, { status: res.status });
    }
  }

  return NextResponse.json(data, { status: res.status });
}

// POST /en/api/post-gres-apis/users/batch
export async function POST(req) {
  try {
    const body = await req.json();
    
    // Validate user_ids array
    if (!body.user_ids || !Array.isArray(body.user_ids)) {
      return NextResponse.json(
        { status: "error", message: "user_ids array is required" },
        { status: 400 }
      );
    }

    if (body.user_ids.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    if (body.user_ids.length > 100) {
      return NextResponse.json(
        { status: "error", message: "Maximum 100 user IDs allowed per request" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;

    const authHeader = req.headers.get("authorization");
    const cookieHeader = req.headers.get("cookie");
    const userHeader = req.headers.get("x-user-id");

    const res = await fetch(`${BASE}/users/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
        ...(userHeader ? { "X-User-Id": userHeader } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (error) {
    console.error("[users/batch POST] error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal error" },
      { status: 500 }
    );
  }
}