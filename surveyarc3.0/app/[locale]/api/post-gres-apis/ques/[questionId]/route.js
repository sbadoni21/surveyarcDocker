// ============================================================
// Next.js 15 SAFE ROUTE (NO x-user-id)
// ============================================================

import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { cookies } from "next/headers";

const BASE = process.env.FASTAPI_BASE_URL;

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
// GET /questions/{questionId}?lang=en
// ============================================================

export async function GET(req, ctx) {
  const { questionId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") || "en";

  const res = await fetch(
    `${BASE}/questions/${encodeURIComponent(questionId)}?lang=${encodeURIComponent(lang)}`,
    { cache: "no-store" }
  );

  const text = await res.text();
  const parsed = safeParse(text);

  if (parsed.ok && looksEncrypted(parsed.json)) {
    return NextResponse.json(await decryptGetResponse(parsed.json), {
      status: res.status,
    });
  }

  return NextResponse.json(parsed.ok ? parsed.json : parsed.raw, {
    status: res.status,
  });
}

// ============================================================
// PATCH /questions/{questionId}
// ============================================================

// ============================================================
// PATCH /questions/{questionId} — FIXED
// ============================================================

export async function PATCH(req, ctx) {
  const { questionId } = await ctx.params;

  if (!questionId) {
    return NextResponse.json(
      { error: "questionId missing" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const currentUserId = cookieStore.get("currentUserId")?.value;

  if (!currentUserId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();

  // 🔐 Encrypt if enabled
  const ENC = process.env.ENCRYPT_QUESTIONS === "1";
  const payload = ENC ? await encryptPayload(body) : body;

  const res = await fetch(
    `${BASE}/questions/${encodeURIComponent(questionId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": currentUserId,
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await res.text();

  // ✅ Handle empty body safely
  if (!text) {
    return NextResponse.json(null, { status: res.status });
  }

  const parsed = safeParse(text);

  if (parsed.ok && looksEncrypted(parsed.json)) {
    return NextResponse.json(
      await decryptGetResponse(parsed.json),
      { status: res.status }
    );
  }

  return NextResponse.json(
    parsed.ok ? parsed.json : { raw: parsed.raw },
    { status: res.status }
  );
}

// ============================================================
// DELETE /questions/{questionId}
// ============================================================

export async function DELETE(_req, ctx) {
  const { questionId } = await ctx.params;

  // ✅ Read user id from cookie
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get("currentUserId")?.value;
console.log(currentUserId)
console.log(questionId)
  if (!currentUserId) {
    return NextResponse.json(
      { error: "Unauthorized: currentUserId cookie missing" },
      { status: 401 }
    );
  }

  const res = await fetch(
    `${BASE}/questions/${encodeURIComponent(questionId)}`,
    {
      method: "DELETE",
      headers: {
        "X-User-Id": currentUserId, // ✅ REQUIRED
      },
    }
  );

  const text = await res.text();
  const parsed = safeParse(text);

  if (parsed.ok && looksEncrypted(parsed.json)) {
    return NextResponse.json(await decryptGetResponse(parsed.json), {
      status: res.status,
    });
  }

  return NextResponse.json(parsed.ok ? parsed.json : parsed.raw, {
    status: res.status,
  });
}