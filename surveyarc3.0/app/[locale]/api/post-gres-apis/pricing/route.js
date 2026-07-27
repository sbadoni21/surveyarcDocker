import pricingPlan from "@/models/pricingModel";
import { decryptGetResponse } from "@/utils/crypto_client";
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

const looksEnvelope = (value) =>
  value &&
  typeof value === "object" &&
  "key_id" in value &&
  "ciphertext" in value &&
  "iv" in value &&
  "tag" in value;

const parseMaybeJson = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
};

async function fetchBackendPlans() {
  if (!BASE) {
    throw new Error("FASTAPI_BASE_URL is not configured");
  }

  const res = await fetch(`${BASE}/pricing-plan`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  const text = await res.text();
  const parsed = parseMaybeJson(text);

  if (!res.ok) {
    const message =
      typeof parsed === "string" ? parsed : JSON.stringify(parsed || {});
    throw new Error(`${res.status} ${res.statusText} :: ${message}`);
  }

  if (looksEnvelope(parsed)) {
    return decryptGetResponse(parsed);
  }

  return parsed;
}

export async function GET() {
  try {
    const data = await fetchBackendPlans();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("GET /api/post-gres-apis/pricing failed, using fallback:", error);
    return NextResponse.json(pricingPlan.getAll(), { status: 200 });
  }
}
