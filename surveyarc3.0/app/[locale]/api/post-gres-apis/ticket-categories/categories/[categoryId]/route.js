
// app/api/post-gres-apis/ticket-categories/categories/[categoryId]/route.js
import { NextResponse } from "next/server";
import { forceDecryptResponse, ENC, BASE } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(req, { params }) {
  const { categoryId } = params;
  const { searchParams } = new URL(req.url);
  const includeSubcategories = searchParams.get("include_subcategories");

  try {
    const queryParams = new URLSearchParams();
    if (includeSubcategories) {
      queryParams.set("include_subcategories", includeSubcategories);
    }

    const url = `${BASE}/ticket-categories/categories/${encodeURIComponent(categoryId)}${
      queryParams.toString() ? `?${queryParams}` : ''
    }`;

    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to fetch category:", e);
    return NextResponse.json(
      { error: "Failed to fetch category", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  const { categoryId } = params;

  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;
    
    const res = await fetch(
      `${BASE}/ticket-categories/categories/${encodeURIComponent(categoryId)}`,
      {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {})
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      }
    );
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to update category:", e);
    return NextResponse.json(
      { error: "Failed to update category", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const { categoryId } = params;

  try {
    const res = await fetch(
      `${BASE}/ticket-categories/categories/${encodeURIComponent(categoryId)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(30000),
      }
    );
    
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to delete category:", e);
    return NextResponse.json(
      { error: "Failed to delete category", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}