import { ProjectProvider } from "@/providers/projectPProvider";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const project = await ProjectProvider.getById(params.projectId);
    if (!project) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    return new Response(JSON.stringify(project), { status: 200 });
  } catch (e) {
    console.error('Error fetching project:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const updateData = await request.json();
    const project = await ProjectProvider.update(params.projectId, updateData);
    return new Response(JSON.stringify(project), { status: 200 });
  } catch (e) {
    console.error('Error updating project:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}


export async function DELETE(request) {
  try {
    const { orgId, projectId } = await request.json();
    await ProjectProvider.delete(orgId, projectId);

 return new Response(null, { status: 204 });  } catch (e) {
    console.error("Error deleting project:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { orgId, projectId } = params;
  const { surveyId } = await request.json();

  if (!surveyId || !orgId || !projectId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Save survey using your SurveyProvider (create new survey doc)
    await surveyProvider.saveSurvey({
      surveyId,
      projectId,
      name: surveyId,       // optional
      createdBy: 'system',  // replace as needed
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
