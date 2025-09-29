

// app/api/post-gres-apis/ticket-categories/products/[productId]/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { forceDecryptResponse } from "@/utils/categoryApiHelpers";

export async function GET(req, { params }) {
  const { productId } = params;

  try {
    const res = await fetch(
      `${BASE}/ticket-categories/products/${encodeURIComponent(productId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }
    );
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("Failed to fetch product:", e);
    return NextResponse.json(
      { error: "Failed to fetch product", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  const { productId } = params;

  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;
    
    const res = await fetch(
      `${BASE}/ticket-categories/products/${encodeURIComponent(productId)}`,
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
    console.error("Failed to update product:", e);
    return NextResponse.json(
      { error: "Failed to update product", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const { productId } = params;

  try {
    const res = await fetch(
      `${BASE}/ticket-categories/products/${encodeURIComponent(productId)}`,
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
    console.error("Failed to delete product:", e);
    return NextResponse.json(
      { error: "Failed to delete product", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}