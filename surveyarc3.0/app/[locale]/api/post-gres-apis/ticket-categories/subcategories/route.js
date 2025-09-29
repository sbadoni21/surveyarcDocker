

// ============================================
// SUBCATEGORIES ROUTES
// ============================================

// app/api/post-gres-apis/ticket-categories/subcategories/route.js
import { NextResponse } from "next/server";
import { forceDecryptResponse, ENC, BASE } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  const categoryId = searchParams.get("category_id");
  const includeInactive = searchParams.get("include_inactive");
  
  if (!orgId && !categoryId) {
    return NextResponse.json(
      { error: "Either org_id or category_id is required" },
      { status: 400 }
    );
  }

  try {
    const params = new URLSearchParams();
    if (orgId) params.set("org_id", orgId);
    if (categoryId) params.set("category_id", categoryId);
    if (includeInactive) params.set("include_inactive", includeInactive);

    const res = await fetch(`${BASE}/ticket-categories/subcategories?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to fetch subcategories:", e);
    return NextResponse.json(
      { error: "Failed to fetch subcategories", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const raw = await req.json();
    
    if (!raw.name || !raw.category_id || !raw.org_id) {
      return NextResponse.json(
        { error: "name, category_id, and org_id are required" },
        { status: 400 }
      );
    }

    const payload = ENC ? await encryptPayload(raw) : raw;
    
    const res = await fetch(`${BASE}/ticket-categories/subcategories`, {
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
    console.error("Failed to create subcategory:", e);
    return NextResponse.json(
      { error: "Failed to create subcategory", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}