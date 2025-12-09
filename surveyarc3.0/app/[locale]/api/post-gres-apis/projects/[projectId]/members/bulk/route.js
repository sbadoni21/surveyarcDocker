// app/en/api/post-gres-apis/projects/[project_id]/members/bulk/route.js
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

// POST /en/api/post-gres-apis/projects/[project_id]/members/bulk
export async function POST(req, { params }) {
  try {
    const body = await req.json();

    // Validate user_uids array
    if (!body.user_uids || !Array.isArray(body.user_uids)) {
      return NextResponse.json(
        { status: "error", message: "user_uids array is required" },
        { status: 400 }
      );
    }

    if (body.user_uids.length === 0) {
      return NextResponse.json(
        { added: 0, skipped: 0, details: [] },
        { status: 200 }
      );
    }

    const payload = ENC ? await encryptPayload(body) : body;

    const authHeader = req.headers.get("authorization");
    const cookieHeader = req.headers.get("cookie");
    const userHeader = req.headers.get("x-user-id");

    const res = await fetch(
      `${BASE}/projects/${params.project_id}/members/bulk`,
      {
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
      }
    );

    return forceDecryptResponse(res);
  } catch (error) {
    console.error("[project members/bulk POST] error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal error" },
      { status: 500 }
    );
  }
}