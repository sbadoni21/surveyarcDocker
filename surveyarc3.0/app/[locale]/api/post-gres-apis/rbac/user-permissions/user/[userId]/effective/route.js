// app/api/post-gres-apis/rbac/user-permissions/user/[userId]/effective/route.js

import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      try {
        return NextResponse.json(await decryptGetResponse(json), { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}

export async function GET(req, { params }) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(req.url);

    const requestUserId = searchParams.get("user") || searchParams.get("user_id");

    const url = new URL(`${BASE}/rbac/user-permissions/user/${userId}/effective`);
    
    // Copy query params
    searchParams.forEach((v, k) => {
      if (k !== "user" && k !== "user_id") {
        url.searchParams.set(k, v);
      }
    });

    console.log("[User Permissions] Fetching effective permissions:", url.toString());

    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        "x-user-id": requestUserId || "",
      },
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[User Permissions] Error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}