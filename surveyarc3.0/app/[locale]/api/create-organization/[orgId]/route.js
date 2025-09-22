import { OrganisationProvider } from '@/providers/organisationPProvider';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  try {
    const { orgId } = params; 

    if (!orgId) {
      return NextResponse.json({ error: 'Missing organization ID' }, { status: 400 });
    }

    const organisation = await OrganisationProvider.getById(orgId);

    if (!organisation) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ organisation });
  } catch (err) {
    console.error('Error fetching organization:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
