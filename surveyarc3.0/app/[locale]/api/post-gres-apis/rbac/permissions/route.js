import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

/**
 * GET /rbac/permissions
 * Query: module?, search?, user, orgId
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  console.log("Query params:", Object.fromEntries(searchParams));

  const userId = searchParams.get("user");
  const orgId = searchParams.get("orgId");
  
  if (!userId) {
    return NextResponse.json(
      { detail: "Missing user parameter" },
      { status: 400 }
    );
  }

  const url = new URL(`${BASE}/rbac/permissions`);
  
  // Pass through relevant query params
  if (searchParams.get("module")) {
    url.searchParams.set("module", searchParams.get("module"));
  }
  if (searchParams.get("search")) {
    url.searchParams.set("search", searchParams.get("search"));
  }
  
  // Set org_id from orgId parameter
  if (orgId) {
    url.searchParams.set("org_id", orgId);
  }

  console.log("Fetching:", url.toString());

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "x-user-id": userId,
    },
  });

  const data = await res.json();
  return NextResponse.json(
    decryptGetResponse ? await decryptGetResponse(data) : data,
    { status: res.status }
  );
}

/**
 * POST /rbac/permissions
 */
export async function POST(req) {
  const body = await req.json();
  console.log("POST body:", body);

  const res = await fetch(`${BASE}/rbac/permissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": body.user_id || "",
    },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await res.json(), { status: res.status });
}