import { decryptGetResponse } from "@/utils/crypto_client";
import { NextResponse } from "next/server";
const BASE = "http://localhost:8000";

export async function GET(req, { params }) {
  const { orgId } = await params;
  console.log(params)
  try {
    const res = await fetch(`${BASE}/users/org/${orgId}`, {
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
            const finalData = await decryptGetResponse(data);

    return NextResponse.json(finalData, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get org users" }, { status: 500 });
  }
}