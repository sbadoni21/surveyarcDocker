import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user");
  const orgId = searchParams.get("org_id");

  if (!userId || !orgId) {
    return NextResponse.json(
      { detail: "Missing required parameters" },
      { status: 400 }
    );
  }

  const url = new URL(`${BASE}/rbac/permissions/roles/batch`);
  url.searchParams.set("user", userId);
  url.searchParams.set("org_id", orgId);

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