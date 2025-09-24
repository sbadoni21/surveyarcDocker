// app/api/post-gres-apis/surveys/[survey_id]/responses/route.js
import { NextResponse } from "next/server";
const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

export async function GET(req, { params }) {
  const { survey_id } = await params;
  const { searchParams } = new URL(req.url);
  const count = searchParams.get("count");

  const url = count
    ? `${BASE}/surveys/${encodeURIComponent(survey_id)}/responses/count`
    : `${BASE}/surveys/${encodeURIComponent(survey_id)}/responses`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const data = await res.text();
    return NextResponse.json(JSON.parse(data), { status: res.status });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e?.message || e) }, { status: 500 });
  }
}
