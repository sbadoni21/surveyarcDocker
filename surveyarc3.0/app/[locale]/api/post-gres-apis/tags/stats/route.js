// app/api/post-gres-apis/tags/stats/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      try {
        const dec = await decryptGetResponse(json);
        return NextResponse.json(dec, { status: res.status });
      } catch (err) {
        return NextResponse.json(json, { status: res.status });
      }
    }
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  try {
    const queryString = searchParams.toString();
    const url = `${BASE}/tags/stats${queryString ? `?${queryString}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}