import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

// POST /api/post-gres-apis/campaigns/webhooks/email
export async function POST(req) {
  try {
    const body = await req.json();
    const url = `${BASE}/campaigns/webhooks/email`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}