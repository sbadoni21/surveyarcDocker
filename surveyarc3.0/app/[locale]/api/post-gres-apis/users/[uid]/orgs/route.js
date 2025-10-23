// /api/post-gres-apis/users/[uid]/orgs/route.js
import { NextResponse } from "next/server";

const BASE = "http://localhost:8000";

export async function POST(req, { params }) {
  const { uid } = await params;
  
  try {
    const body = await req.json();
    const { org_id } = body;
    
    const res = await fetch(`${BASE}/users/${uid}/orgs?org_id=${org_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000)
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
    
  } catch (error) {
    console.error("Add org error:", error);
    return NextResponse.json(
      { error: "Failed to add organization", message: error.message },
      { status: 500 }
    );
  }
}