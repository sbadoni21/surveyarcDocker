// app/api/post-gres-apis/slas/[org_id]/import/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;

async function forceDecryptResponse(res) {
  const txt = await res.text();
  try {
    const json = JSON.parse(txt);
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: txt }, { status: res.status });
  }
}

export async function POST(req, { params }) {
  const { org_id } = await params;
  const { searchParams } = new URL(req.url);
  
  const qs = new URLSearchParams();
  const update_existing = searchParams.get("update_existing");
  if (update_existing !== null) qs.set("update_existing", update_existing);

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    
    if (!file) {
      return NextResponse.json({ detail: "No file provided" }, { status: 400 });
    }

    // Create FormData for FastAPI
    const fastApiFormData = new FormData();
    fastApiFormData.append("file", file);

    const res = await fetch(`${BASE}/slas/${encodeURIComponent(org_id)}/import?${qs.toString()}`, {
      method: "POST",
      body: fastApiFormData,
      signal: AbortSignal.timeout(120000),
      cache: "no-store",
    });
    
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}