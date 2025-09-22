import { SurveyProvider } from "@/providers/surveyPProvider";
import { NextResponse } from "next/server";

// PUT: Save logicXML
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org");
    const surveyId = searchParams.get("surveyId");
    if (!orgId || !surveyId) {
      return NextResponse.json(
        { error: "Missing orgId or surveyId" },
        { status: 400 }
      );
    }
    const xml = await req.text(); 

    console.log("Received XML:", xml);

    await SurveyProvider.updateSurvey(orgId, surveyId, {rules: xml} );

    return NextResponse.json({ message: "Rules saved successfully" });
  } catch (err) {
    console.error("Error saving rules:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Retrieve logicXML
export async function GET(req, context) {
  try {
    const { surveyId } = context.params;
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org");

    if (!orgId || !surveyId) {
      return NextResponse.json(
        { error: "Missing orgId or surveyId" },
        { status: 400 }
      );
    }

    const survey = await SurveyProvider.getSurvey(surveyId);

    if (!survey || !survey.logicXML) {
      return NextResponse.json(
        { error: "Survey or logicXML not found" },
        { status: 404 }
      );
    }

    return new NextResponse(survey.logicXML, {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err) {
    console.error("Error getting rules:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
