import { NextResponse } from "next/server";
import { SurveyProvider } from "@/providers/surveyPProvider";
import { QuestionProvider } from "@/providers/questionPProvider";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const projectId = searchParams.get("projectId");
    const surveyId = searchParams.get("surveyId");

    if (!orgId || !projectId || !surveyId) {
      return NextResponse.json(
        { error: "Missing orgId, projectId, or surveyId" },
        { status: 400 }
      );
    }
    const survey = await SurveyProvider.getSurvey(orgId, surveyId);

    if (!survey || !Array.isArray(survey.questionOrder)) {
      return NextResponse.json(
        { error: "Survey not found or invalid" },
        { status: 404 }
      );
    }

    const questionPromises = survey.questionOrder.map((id) =>
      QuestionProvider.get(orgId, surveyId, id)
    );
    const questions = await Promise.all(questionPromises);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("Error fetching survey questions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
