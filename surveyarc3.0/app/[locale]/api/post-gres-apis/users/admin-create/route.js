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

  if (Array.isArray(parsed.json)) {
    const out = await Promise.all(
      parsed.json.map(async (item) =>
        looksEnvelope(item) ? await decryptGetResponse(item) : item
      )
    );
    return NextResponse.json(out, { status: res.status });
  }

  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }

  return NextResponse.json(parsed.json, { status: res.status });
}

// POST /api/post-gres-apis/users/admin-create
export async function POST(req) {
  try {
    const body = await req.json();

    // Map frontend camelCase to backend snake_case
    const payloadRaw = {
      email: body.email,
      current_user_id: body.current_user_id || "",
      password: body.password,
      display_name: body.displayName || body.display_name,
      role: body.role ?? "member",
      org_id: body.orgId || body.org_id,
      status: body.status ?? "active",
      meta_data: body.metaData || body.meta_data || {},
    };

    const payload = ENC ? await encryptPayload(payloadRaw) : payloadRaw;

    // Get auth token from request headers or cookies
    const authHeader = req.headers.get("authorization");
    const cookieHeader = req.headers.get("cookie");

    const res = await fetch(`${BASE}/users/admin-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-USER-ID":payload.current_user_id || "",
        ...(ENC ? { "x-encrypted": "1" } : {}),
        // Forward authentication
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (error) {
    console.error("❌ admin-create user proxy error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal error" },
      { status: 500 }
    );
  }
}