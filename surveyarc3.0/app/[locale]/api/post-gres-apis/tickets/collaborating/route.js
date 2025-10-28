import { NextResponse } from "next/server";
const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  const userId = searchParams.get("user_id");
  const status = searchParams.get("status");
  const limit = searchParams.get("limit") || "50";
  const offset = searchParams.get("offset") || "0";

  try {
    const qs = new URLSearchParams({ org_id: orgId, user_id: userId, limit, offset });
    if (status) qs.set("status", status);
    const res = await fetch(`${BASE}/tickets/collaborating?${qs.toString()}`, {
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text || [] }
    return NextResponse.json(data, { status: res.status || 502 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch collaborating tickets" }, { status: 500 });
  }
}
