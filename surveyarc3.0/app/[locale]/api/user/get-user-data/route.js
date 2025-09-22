import { UserProvider } from '@/providers/UserPProvider';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  console.log(searchParams)
  const uid = searchParams.get('uid');
  try {
    const user = await UserProvider.getUser(uid);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
