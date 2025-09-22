import { NextResponse } from "next/server";

const BASE = "http://localhost:8000" || "http://fastapi-backend:8000";
// GET /api/pricing  →  FastAPI /pricing
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const url = id ? `${BASE}/pricing-plan/${encodeURIComponent(id)}` : `${BASE}/pricing-plan`;
  const res = await fetch(url, { cache: "no-store" });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }

  return NextResponse.json(data, { status: res.status });
}
