import { NextResponse } from "next/server";
const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req, { params }) {
  const { email } = params;
  try {
    const res = await fetch(`${BASE}/users/email/${email}`, {
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get user by email" }, { status: 500 });
  }
}