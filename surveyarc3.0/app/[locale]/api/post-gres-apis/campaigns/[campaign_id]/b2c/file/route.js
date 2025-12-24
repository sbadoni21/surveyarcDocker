// app/api/post-gres-apis/campaigns/[campaign_id]/b2c/file/route.js

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

    const url = `${BASE}/campaigns/${encodeURIComponent(campaign_id)}/b2c/file`;
    
    console.log("📥 Downloading B2C file from:", url);

    const res = await fetch(url, {
      headers: {
        "X-User-Id": userId || "",
      },
      signal: AbortSignal.timeout(60000), // 60 second timeout for file downloads
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Backend error:", res.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to download file" },
        { status: res.status }
      );
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = res.headers.get('Content-Disposition');
    let filename = `campaign_${campaign_id}_results.csv`;
    
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }

    // Get the blob
    const blob = await res.blob();
    
    console.log("✅ File downloaded successfully:", filename);

    // Return as Response with proper headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
    
  } catch (error) {
    console.error("❌ B2C file download error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download file" },
      { status: 500 }
    );
  }
}