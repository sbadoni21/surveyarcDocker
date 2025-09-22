import { ProjectProvider } from "@/providers/projectPProvider";

export async function DELETE(request, { params }) {
  try {
    await ProjectProvider.removeSurveyId(params.projectId, params.surveyId);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('Error removing survey ID:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
