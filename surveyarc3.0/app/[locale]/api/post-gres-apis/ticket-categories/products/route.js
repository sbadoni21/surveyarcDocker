
// app/api/post-gres-apis/ticket-categories/products/route.js
import { NextResponse } from "next/server";
import { forceDecryptResponse, ENC, BASE } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  const platform = searchParams.get("platform");
  const includeInactive = searchParams.get("include_inactive");
  
  if (!orgId) {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ org_id: orgId });
    if (platform) params.set("platform", platform);
    if (includeInactive) params.set("include_inactive", includeInactive);

    const res = await fetch(`${BASE}/ticket-categories/products?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to fetch products:", e);
    return NextResponse.json(
      { error: "Failed to fetch products", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const raw = await req.json();
    
    if (!raw.name || !raw.code || !raw.org_id) {
      return NextResponse.json(
        { error: "name, code, and org_id are required" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(raw) : raw;
    
    const res = await fetch(`${BASE}/ticket-categories/products`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to create product:", e);
    return NextResponse.json(
      { error: "Failed to create product", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
