import { SurveyProvider } from "@/providers/surveyPProvider";
import { NextResponse } from "next/server";

export async function PUT(req, { params }) {
  const body = await req.json();
  const { surveyId, orgId, projectId, questionOrder } = body;

  if (!orgId || !projectId || !Array.isArray(questionOrder)) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    await SurveyProvider.updateSurvey(orgId, surveyId, questionOrder); // Implement this in your provider
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
