// .../participant-sources/[sourceId]/track/start/route.js
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

export async function POST(req, { params }) {
  const { sourceId } = await params;

  try {
    const res = await fetch(
      `${BASE}/participant-sources/${sourceId}/track/start`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }
    );

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("POST track start error:", err);
    return NextResponse.json(
      { detail: "Failed to track start" },
      { status: 500 }
    );
  }
}
