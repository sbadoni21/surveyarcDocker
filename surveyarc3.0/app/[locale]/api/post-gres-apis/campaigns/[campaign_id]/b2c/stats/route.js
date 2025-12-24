// app/api/post-gres-apis/campaigns/[campaign_id]/b2c/stats/route.js

import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req, { params }) {
  try {
    const { campaign_id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!campaign_id) {
      return NextResponse.json(
        { error: "Missing campaign_id" },
        { status: 400 }
      );
    }

    const url = `${BASE}/campaigns/${encodeURIComponent(campaign_id)}/b2c/stats`;
    
    console.log("📊 Fetching B2C stats from:", url);

    const res = await fetch(url, {
      headers: {
        "X-User-Id": userId || "",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Backend error:", res.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to get stats" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("❌ B2C stats error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get stats" },
      { status: 500 }
    );
  }
}