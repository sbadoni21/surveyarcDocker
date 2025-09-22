import { NextResponse } from "next/server";
const BASE = "http://localhost:8000" || "http://fastapi-backend:8000";


export async function POST(req) {
  const body = await req.json();
  const res = await fetch(`${BASE}/tickets/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("org_id");
  const surveyId = searchParams.get("survey_id");
  const questionId = searchParams.get("question_id");

  let url = `${BASE}/tickets/`;
  if (orgId) url = `${BASE}/tickets/org/${encodeURIComponent(orgId)}`;
  else if (surveyId) url = `${BASE}/tickets/survey/${encodeURIComponent(surveyId)}`;
  else if (questionId) url = `${BASE}/tickets/question/${encodeURIComponent(questionId)}`;
  else return NextResponse.json({ detail: "Provide org_id or survey_id or question_id" }, { status: 400 });

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
