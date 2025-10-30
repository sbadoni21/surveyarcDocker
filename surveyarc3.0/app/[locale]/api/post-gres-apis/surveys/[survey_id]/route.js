// app/api/post-gres-apis/surveys/[survey_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

const looksEncrypted = (o) =>
  o && typeof o === "object" &&
  "key_id" in o && "encrypted_key" in o &&
  "ciphertext" in o && "iv" in o && "tag" in o;

const safeParse = (t) => { try { return { ok: true, json: JSON.parse(t) }; } catch { return { ok: false, raw: t }; } };

async function forceDecryptResponse(res, label = "") {
  const text = await res.text();

  const parsed = safeParse(text);
  if (!parsed.ok) {
    console.warn(`[${label}] not JSON, returning raw`);
    return NextResponse.json({ status: "error", raw: parsed.raw }, { status: res.status });
  }

  const data = parsed.json;

  // Object envelope
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (looksEncrypted(data)) {
      try {
        const dec = await decryptGetResponse(data);
        return NextResponse.json(dec, { status: res.status });
      } catch (e) {
        console.warn(`[${label}] ❌ decrypt failed, returning raw object:`, e);
        return NextResponse.json(data, { status: res.status });
      }
    }
    // Not an encrypted envelope
    return NextResponse.json(data, { status: res.status });
  }

  // Array of possibly encrypted items
  if (Array.isArray(data)) {
    try {
      const dec = await Promise.all(
        data.map(async (item, i) => {
          if (item && typeof item === "object" && looksEncrypted(item)) {
            try {
              const d = await decryptGetResponse(item);
              return d;
            } catch (e) {
              console.warn(`[${label}] ❌ decrypt failed for item[${i}], returning raw`, e);
              return item;
            }
          }
          return item;
        })
      );
      return NextResponse.json(dec, { status: res.status });
    } catch (e) {
      console.warn(`[${label}] ❌ array decrypt failed, returning raw`, e);
      return NextResponse.json(data, { status: res.status });
    }
  }

  // Primitive JSON
  return NextResponse.json(data, { status: res.status });
}

function toSnakeCasePatch(body) {
  const out = { ...body };
  if ("blockOrder" in out) { out.block_order = out.blockOrder; delete out.blockOrder; }
  if ("questionOrder" in out) { out.question_order = out.questionOrder; delete out.questionOrder; }
  return out;
}

export async function GET(_req, { params }) {
  const { survey_id } = await params;
  try {
    const res = await fetch(`${BASE}/surveys/${encodeURIComponent(survey_id)}`, {
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res, "GET /surveys/[id]");
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { survey_id } = await params;
  try {
    const raw = await req.json();

    const snake = toSnakeCasePatch(raw);

    const payload = ENC ? await encryptPayload(snake) : snake;

    const res = await fetch(`${BASE}/surveys/${encodeURIComponent(survey_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res, "PATCH /surveys/[id]");
  } catch (e) {
    console.error("[PATCH] ❌ error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { survey_id } = await params;

  try {
    const res = await fetch(`${BASE}/surveys/${encodeURIComponent(survey_id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000),
    });
    return forceDecryptResponse(res, "DELETE /surveys/[id]");
  } catch (e) {
    console.error("[DELETE] ❌ error:", e);
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}
