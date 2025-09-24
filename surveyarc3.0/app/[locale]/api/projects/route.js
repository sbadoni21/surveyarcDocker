import { ProjectProvider } from "@/providers/projectPProvider";

export async function POST(request) {
  try {
    const data = await request.json();
    const project = await ProjectProvider.createProject(data); 
    return new Response(JSON.stringify(project), { status: 201 });
  } catch (e) {
    console.error('Error creating project:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('orgId');
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Missing orgId' }), { status: 400 });
    }

    const projects = await ProjectProvider.getAll(orgId);
    return new Response(JSON.stringify(projects), { status: 200 });
  } catch (e) {
    console.error('Error fetching projects:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
export async function DELETE(request) {
  try {
    const body = await request.json();
    if (!body || !body.orgId || !body.projectId) {
      return new Response(JSON.stringify({ error: 'Missing orgId or projectId' }), { status: 400 });
    }
    const { orgId, projectId } = body;

    if (!orgId || !projectId) {
      return new Response(JSON.stringify({ error: 'Missing orgId or projectId' }), { status: 400 });
    }

    await ProjectProvider.deleteProject(orgId, projectId);
    return new Response(JSON.stringify({ message: 'Project deleted successfully' }), { status: 200 });
  } catch (e) {
    console.error('Error deleting project:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}