import { ProjectProvider } from "@/providers/projectPProvider";

export async function DELETE(request, { params }) {
  try {
    await ProjectProvider.removeMember(params.projectId, params.memberUid);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('Error removing member:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
