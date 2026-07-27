import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

/**
 * GET /rbac/permissions/roles/batch
 * Query: user, org_id
 * Returns: Object mapping role_id -> permissions[]
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  console.log("Batch query params:", Object.fromEntries(searchParams));

  const userId = searchParams.get("user");
  const orgId = searchParams.get("org_id");

  if (!userId) {
    return NextResponse.json(
      { detail: "Missing user parameter" },
      { status: 400 }
    );
  }

  if (!orgId) {
    return NextResponse.json(
      { detail: "Missing org_id parameter" },
      { status: 400 }
    );
  }

  const url = new URL(`${BASE}/rbac/permissions/roles/batch`);
  url.searchParams.set("user", userId);
  url.searchParams.set("org_id", orgId);

  console.log("Fetching:", url.toString());

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        "x-user-id": userId,
      },
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Batch fetch failed:", errorData);
      return NextResponse.json(
        decryptGetResponse ? await decryptGetResponse(errorData) : errorData,
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log("Batch fetch successful, roles count:", Object.keys(data).length);

    return NextResponse.json(
      decryptGetResponse ? await decryptGetResponse(data) : data,
      { status: res.status }
    );
  } catch (error) {
    console.error("Error in batch route:", error);
    return NextResponse.json(
      { 
        detail: "Internal server error", 
        error: error.message 
      },
      { status: 500 }
    );
  }
}