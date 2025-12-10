// .../participant-sources/[sourceId]/track/click/route.js
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

export async function POST(req, { params }) {
  const { sourceId } = await params;

  try {
    const res = await fetch(
      `${BASE}/participant-sources/${sourceId}/track/click`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}", // empty JSON; FastAPI ignores payload
      }
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("POST track click error:", err);
    return NextResponse.json(
      { detail: "Failed to track click" },
      { status: 500 }
    );
  }
}
