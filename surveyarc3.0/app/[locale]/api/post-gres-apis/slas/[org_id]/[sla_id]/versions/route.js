// app/api/post-gres-apis/slas/[sla_id]/versions/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

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

export async function GET(_req, { params }) {
  const { sla_id } = await params;
  try {
    const res = await fetch(`${BASE}/slas/${encodeURIComponent(sla_id)}/versions`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}