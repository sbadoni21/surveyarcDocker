import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req, { params }) {
  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  
  if (!userId) {
    return NextResponse.json({ detail: "userId is required" }, { status: 400 });
  }

  try {
    // Build URL properly with org_id if provided
    const url = new URL(`${BASE}/rbac/user/${encodeURIComponent(userId)}/permissions`);
    if (orgId) {
      url.searchParams.set("org_id", orgId);
    }

    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        "x-user-id": userId, // auth context
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    // Parse response
    const data = await res.json();

    // Handle non-OK responses
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // Decrypt if needed
    const result = decryptGetResponse ? await decryptGetResponse(data) : data;
    
    return NextResponse.json(result, { status: res.status });

  } catch (e) {
    // Check if it's a timeout
    if (e.name === 'AbortError' || e.name === 'TimeoutError') {
      return NextResponse.json(
        { detail: "Request timeout", message: "Upstream service took too long to respond" },
        { status: 504 }
      );
    }

    // Network or other errors
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}