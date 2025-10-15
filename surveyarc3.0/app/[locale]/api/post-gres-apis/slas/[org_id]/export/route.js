// app/api/post-gres-apis/slas/[org_id]/export/route.js
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

export async function GET(req, { params }) {
  const { org_id } = await params;
  const { searchParams } = new URL(req.url);
  
  const qs = new URLSearchParams();
  ["include_objectives", "include_credit_rules"].forEach((k) => {
    const v = searchParams.get(k);
    if (v !== null && v !== undefined && v !== "") qs.set(k, v);
  });

  try {
    const res = await fetch(`${BASE}/slas/${encodeURIComponent(org_id)}/export?${qs.toString()}`, {
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
    
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ detail: "Export failed", raw: txt }, { status: res.status });
    }

    // Stream the file response
    const blob = await res.blob();
    const headers = new Headers();
    
    // Copy relevant headers from FastAPI response
    const contentDisposition = res.headers.get("content-disposition");
    if (contentDisposition) {
      headers.set("content-disposition", contentDisposition);
    } else {
      headers.set("content-disposition", `attachment; filename=slas_${org_id}_export.json`);
    }
    
    headers.set("content-type", "application/json");
    
    return new NextResponse(blob, { status: 200, headers });
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}