import { ProjectProvider } from "@/providers/projectPProvider";

export async function POST(request, { params }) {
  try {
    const member = await request.json();
    await ProjectProvider.addMember(params.projectId, member);
    return new Response(null, { status: 204 });
  } catch (e) {
    console.error('Error adding member:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
