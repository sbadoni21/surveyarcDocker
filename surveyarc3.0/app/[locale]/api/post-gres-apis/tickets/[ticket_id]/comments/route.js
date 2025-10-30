import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

/** Uniform decryptor for GET/POST pass-through */
async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      try {
        const dec = await decryptGetResponse(json);
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

/** GET /api/post-gres-apis/tickets/:ticket_id/comments → list comments */
export async function GET(_req, { params }) {
  const { ticket_id } =  await params;
  try {
    const res = await fetch(
      `${BASE}/tickets/${encodeURIComponent(ticket_id)}/comments`,
      { cache: "no-store" }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/** POST /api/post-gres-apis/tickets/:ticket_id/comments → create comment
 * Accept both:
 *  - { ticket_id, author_id, body, is_internal? }
 *  - or legacy: { uid, comment, is_internal? } and we map it
 */
export async function POST(req, { params }) {
  const { ticket_id } = await params;
  try {
    const rawIn = await req.json();

    // Shape normalization
    const payloadNormalized = rawIn?.ticket_id
      ? rawIn
      : {
          ticket_id,
          author_id: rawIn?.author_id || rawIn?.uid,   // map uid → author_id
          body: rawIn?.body ?? rawIn?.comment ?? "",
          is_internal: !!rawIn?.is_internal,
          comment_id: rawIn?.comment_id ?? undefined,
        };

    if (!payloadNormalized?.author_id || !payloadNormalized?.body) {
      return NextResponse.json(
        { detail: "author_id and body are required" },
        { status: 400 }
      );
    }

    const outgoing = ENC ? await encryptPayload(payloadNormalized) : payloadNormalized;

    const res = await fetch(
      `${BASE}/tickets/${encodeURIComponent(ticket_id)}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
        },
        body: JSON.stringify(outgoing),
      }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
