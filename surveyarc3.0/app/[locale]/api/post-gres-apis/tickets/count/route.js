// app/api/post-gres-apis/tickets/count/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /api/post-gres-apis/tickets/count?org_id=...&status=optional
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  for (const k of ["org_id", "status"]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") qs.set(k, v);
  }

  try {
    const res = await fetch(`${BASE}/tickets/counts/org?${qs.toString()}`, {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
