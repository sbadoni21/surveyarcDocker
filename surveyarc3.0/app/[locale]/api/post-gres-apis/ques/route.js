// ============================================================
// POST /api/post-gres-apis/ques  (ENCRYPTED + AUTH SAFE)
// ============================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_QUESTIONS === "1";

// ----------------------------
// Helpers
// ----------------------------

const looksEncrypted = (o) =>
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

// ============================================================
// POST
// ============================================================

export async function POST(req) {
  try {
    // ✅ Next.js 15 SAFE cookie access
    const cookieStore = await cookies();
    const currentUserId = cookieStore.get("currentUserId")?.value;

    if (!currentUserId) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Encrypt payload if enabled
    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": currentUserId, // ✅ REQUIRED by FastAPI
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const text = await res.text();
    const parsed = safeParse(text);

    // Decrypt response if encrypted
    if (parsed.ok && looksEncrypted(parsed.json)) {
      const dec = await decryptGetResponse(parsed.json);
      return NextResponse.json(dec, { status: res.status });
    }

    return NextResponse.json(
      parsed.ok ? parsed.json : { status: "error", raw: parsed.raw },
      { status: res.status }
    );
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
