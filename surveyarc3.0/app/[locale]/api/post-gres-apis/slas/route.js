// app/api/post-gres-apis/slas/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) =>
            item && typeof item === "object"
              ? (await decryptGetResponse(item).catch(() => item))
              : item
          )
        );
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/slas?org_id=...&active=...&scope=...&q=...&limit=...&offset=...
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();

  // pass-through known filters
  ["org_id", "active", "scope", "q", "limit", "offset"].forEach((k) => {
    const v = searchParams.get(k);
    if (v !== null && v !== undefined && v !== "") qs.set(k, v);
  });

  try {
    const res = await fetch(`${BASE}/slas?${qs.toString()}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// POST /api/post-gres-apis/slas
export async function POST(req) {
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/slas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
