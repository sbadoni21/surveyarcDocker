// /app/api/org/[orgId]/route.ts
import { OrganisationProvider } from '@/providers/organisationPProvider';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  try {
    const user = await OrganisationProvider.getById(orgId);
    if (!user) return NextResponse.json({ error: 'orgId not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
