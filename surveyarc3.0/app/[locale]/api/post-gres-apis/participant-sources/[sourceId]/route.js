// app/api/post-gres-apis/participant-sources/[sourceId]/route.js
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
  if (!parsed.ok) return NextResponse.json({ status: "error", raw: parsed.raw }, { status: res.status });
  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }
  return NextResponse.json(parsed.json, { status: res.status });
}

export async function GET(_req, { params }) {
  const { sourceId } = await params;
  try {
    const res = await fetch(
      `${BASE}/participant-sources/${encodeURIComponent(sourceId)}`,
      { signal: AbortSignal.timeout(30000) }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  const { sourceId } = params;
  try {
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(
      `${BASE}/participant-sources/${encodeURIComponent(sourceId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  const { sourceId } = params;
  try {
    const res = await fetch(
      `${BASE}/participant-sources/${encodeURIComponent(sourceId)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(30000),
      }
    );
    const text = await res.text();
    const parsed = safeParse(text);
    return NextResponse.json(parsed.ok ? parsed.json : { status: "error", raw: parsed.raw }, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
