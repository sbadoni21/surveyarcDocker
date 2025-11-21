import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RESPONSES === "1";

const looksEnvelope = (o) =>
  o && typeof o === "object" &&
  "key_id" in o && "encrypted_key" in o &&
  "ciphertext" in o && "iv" in o && "tag" in o;

const safeParse = (t) => { try { return { ok: true, json: JSON.parse(t) }; } catch { return { ok: false, raw: t }; } };

async function decryptResponse(res) {
  const text = await res.text();
  const parsed = safeParse(text);
  if (!parsed.ok) return NextResponse.json({ error: parsed.raw }, { status: res.status });

  if (Array.isArray(parsed.json)) {
    const out = await Promise.all(
      parsed.json.map((i) => looksEnvelope(i) ? decryptGetResponse(i) : i)
    );
    return NextResponse.json(out, { status: res.status });
  }

  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }

  return NextResponse.json(parsed.json, { status: res.status });
}

export async function GET(req, ctx) {
  const { path } = ctx.params;

  const urlPath = path.join("/");
  const url = `${BASE}/quotas/${urlPath}${req.nextUrl.search}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
    });

    return decryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req, ctx) {
  const { path } = ctx.params;

  const urlPath = path.join("/");
  const url = `${BASE}/quotas/${urlPath}`;

  try {
    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    return decryptResponse(res);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
