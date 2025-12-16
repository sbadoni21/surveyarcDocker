import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      try {
        return NextResponse.json(await decryptGetResponse(json), { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/rbac/check-permission
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const qs = new URLSearchParams(searchParams);

    const res = await fetch(
      `${BASE}/rbac/check-permission?${qs.toString()}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }
    );

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
