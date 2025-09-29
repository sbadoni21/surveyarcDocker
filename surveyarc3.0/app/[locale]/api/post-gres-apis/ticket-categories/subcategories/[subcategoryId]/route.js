
// app/api/post-gres-apis/ticket-categories/subcategories/[subcategoryId]/route.js
import { NextResponse } from "next/server";
import { forceDecryptResponse, ENC, BASE } from "@/utils/categoryApiHelpers";
import { encryptPayload } from "@/utils/crypto_utils";

export async function GET(req, { params }) {
  const { subcategoryId } = params;

  try {
    const res = await fetch(
      `${BASE}/ticket-categories/subcategories/${encodeURIComponent(subcategoryId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }
    );
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to fetch subcategory:", e);
    return NextResponse.json(
      { error: "Failed to fetch subcategory", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  const { subcategoryId } = params;

  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;
    
    const res = await fetch(
      `${BASE}/ticket-categories/subcategories/${encodeURIComponent(subcategoryId)}`,
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
    console.error("Failed to update subcategory:", e);
    return NextResponse.json(
      { error: "Failed to update subcategory", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const { subcategoryId } = params;

  try {
    const res = await fetch(
      `${BASE}/ticket-categories/subcategories/${encodeURIComponent(subcategoryId)}`,
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
    console.error("Failed to delete subcategory:", e);
    return NextResponse.json(
      { error: "Failed to delete subcategory", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}