// app/api/post-gres-apis/slas/[org_id]/compliance/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

async function forceDecryptResponse(res) {
  const txt = await res.text();
  try {
    const json = JSON.parse(txt);
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
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: txt }, { status: res.status });
  }
}

export async function GET(req, { params }) {
  const { org_id } = await params;
  const { searchParams } = new URL(req.url);
  
  const qs = new URLSearchParams();
  ["from_date", "to_date"].forEach((k) => {
    const v = searchParams.get(k);
    if (v !== null && v !== undefined && v !== "") qs.set(k, v);
  });

  try {
    const res = await fetch(`${BASE}/slas/${encodeURIComponent(org_id)}/compliance?${qs.toString()}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}