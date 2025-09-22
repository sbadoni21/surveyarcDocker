import { UserProvider } from "@/providers/UserPProvider";

export async function POST(request) {
  try {
    const data = await request.json();
    const { uid, email, displayName, role, orgId } = data;
    if (!uid || !email) {
      return new Response(JSON.stringify({ error: 'Missing uid or email' }), { status: 400 });
    }
    const userData = {
      uid,
      email,
      displayName: displayName || '',
      role: role || 'user',
      orgId: orgId || null,
    };
    await UserProvider.createUser(userData);

    return new Response(JSON.stringify({ message: 'User created', user: userData }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to create user: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
