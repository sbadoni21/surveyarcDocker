import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

// ✅ Use env, never `"a" || "b"`
const BASE = "http://localhost:8000";

// Small helper to show backend errors clearly
function jsonErr(status, detail) {
  return NextResponse.json({ detail }, { status });
}

/* ----------------------- CREATE ----------------------- */
export async function POST(req) {
  try {
    const body = await req.json();
    const encryptedBody = await encryptPayload(body);

    // ❌ you had an extra '{' after body: ... which breaks options
    const res = await fetch(`${BASE}/projects/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedBody),
      cache: "no-store",
    });

    const txt = await res.text();
    let data;
    try { data = txt ? JSON.parse(txt) : {}; } catch { data = {}; }

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    // ECONNREFUSED ends up here
    return jsonErr(502, `Projects POST failed: ${(e && e.message) || e}`);
  }
}

/* ----------------------- LIST ----------------------- */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return jsonErr(400, "orgId is required");

    const res = await fetch(`${BASE}/projects/${orgId}`, { cache: "no-store" });
    const raw = await res.text();

    if (raw && /^<!doctype|^<html/i.test(raw)) {
      return jsonErr(502, "Bad gateway from backend (HTML received).");
    }

    let encrypted; try { encrypted = raw ? JSON.parse(raw) : {}; } catch { encrypted = {}; }
    let data = await decryptGetResponse(encrypted);

    if (!Array.isArray(data)) data = []; // guard for UI
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return jsonErr(502, `Projects GET failed: ${(e && e.message) || e}`);
  }
}

/* ----------------------- UPDATE ----------------------- */
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { orgId, projectId, ...rest } = body;
    if (!orgId || !projectId) return jsonErr(400, "orgId and projectId are required");

    const encryptedBody = await encryptPayload(rest);

    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedBody),
      cache: "no-store",
    });

    const txt = await res.text();
    let data; try { data = txt ? JSON.parse(txt) : {}; } catch { data = {}; }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return jsonErr(502, `Projects PATCH failed: ${(e && e.message) || e}`);
  }
}
