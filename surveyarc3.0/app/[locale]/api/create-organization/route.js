import { NextResponse } from 'next/server';
import { OrganisationProvider } from '@/providers/organisationPProvider';
import { UserProvider } from '@/providers/UserPProvider';


export async function POST(req) {
  try {
    const body = await req.json();
    const { uid, orgName, ownerUID,ownerEmail, industry, size,region,country,timezone  } = body;
    if (!uid || !orgName || !ownerUID) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await OrganisationProvider.create({
      uid,
      name: orgName,
      ownerUID,
      industry: industry || '',
      organisationSize: Number(size || 1),
      region:region,
      country:country,
      timezone: timezone,
      ownerEmail: ownerEmail || '',
    });
    await UserProvider.updateUser(ownerUID, { orgId: uid });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error creating organization and linking user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
