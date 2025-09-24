import { NextResponse } from "next/server";
const BASE = "http://localhost:8000";

export async function GET(req, { params }) {
  const { uid } = params;
  try {
    const res = await fetch(`${BASE}/users/${uid}/session`, {
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { uid } = params;
  try {
    const res = await fetch(`${BASE}/users/${uid}/session`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}