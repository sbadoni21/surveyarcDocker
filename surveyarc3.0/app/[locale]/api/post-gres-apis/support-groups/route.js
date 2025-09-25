import { NextResponse } from "next/server";
const BASE = "http://localhost:8000";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  try {
    const url = `${BASE}/support-groups?org_id=${encodeURIComponent(orgId)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text || [] }
    return NextResponse.json(data, { status: res.status || 502 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch support groups" }, { status: 500 });
  }
}
