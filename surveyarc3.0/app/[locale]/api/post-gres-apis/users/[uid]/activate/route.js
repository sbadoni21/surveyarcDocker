import { NextResponse } from "next/server";
const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;

export async function POST(req, { params }) {
  const { uid } = params;
  try {
    const res = await fetch(`${BASE}/users/${uid}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to activate user" }, { status: 500 });
  }
}