import { decryptGetResponse } from "@/utils/crypto_client";
import { NextResponse } from "next/server";

const BASE ="http://fastapi-backend:8000";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const url = id
    ? `${BASE}/pricing-plan/${encodeURIComponent(id)}`
    : `${BASE}/pricing-plan`;
  const res = await fetch(url, { cache: "no-store" });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (err) {
    console.error("Failed to parse JSON:", text, err);
    return NextResponse.json(
      { error: "Invalid JSON from backend" },
      { status: 500 }
    );
  }

  let data;
  try {
    data = await decryptGetResponse(body);
  } catch (err) {
    console.error("Decryption failed:", err);
    return NextResponse.json({ error: "Decryption failed" }, { status: 500 });
  }
  return NextResponse.json(data, { status: res.status });
}