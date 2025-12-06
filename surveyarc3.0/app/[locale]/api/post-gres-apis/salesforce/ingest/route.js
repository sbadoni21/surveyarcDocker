import { NextResponse } from "next/server";
import * as admin from "firebase-admin";

/** ---------- Firebase Admin (server-only) ---------- */
function initAdmin() {
  if (!admin.apps.length) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "{}";
      const parsed = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
    } catch (e) {
      console.error("Firebase admin init failed");
      throw new Error("Firebase configuration error");
    }
  }
  return { db: admin.firestore() };
}

/** ---------- Salesforce Auth Helpers ---------- */
async function getSalesforceAccess() {
  // Fast path: use provided access token + instance url if present
  const presetToken = (process.env.SALESFORCE_ACCESS_TOKEN || "").trim();
  const presetInstance = (process.env.SALESFORCE_INSTANCE_URL || "").replace(/\/+$/, "");
  if (presetToken && presetInstance) {
    return { accessToken: presetToken, instanceUrl: presetInstance };
  }

  // Otherwise do password grant
  const loginUrl = (process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com").replace(/\/+$/, "");
  const client_id = process.env.SALESFORCE_CLIENT_ID;
  const client_secret = process.env.SALESFORCE_CLIENT_SECRET;
  const username = process.env.SALESFORCE_USERNAME;
  const password = (process.env.SALESFORCE_PASSWORD || "").replace(/\s+$/, "");

  if (!client_id || !client_secret || !username || !password) {
    throw new Error("Missing Salesforce env vars (CLIENT_ID/SECRET/USERNAME/PASSWORD).");
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id,
    client_secret,
    username,
    password, // append security token here in .env if required
  });

  const resp = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`Salesforce auth failed: ${resp.status} ${text}`);
  const data = JSON.parse(text);
  if (!data.access_token || !data.instance_url) throw new Error(`Auth response missing fields: ${text}`);
  return { accessToken: data.access_token, instanceUrl: data.instance_url.replace(/\/+$/, "") };
}

/** ---------- Salesforce REST helpers ---------- */
function mask(str = "") {
  if (!str) return "";
  return str.slice(0, 6) + "***" + str.slice(-4);
}

async function sfUpsertExternalId(instanceUrl, accessToken, sobject, externalFieldApiName, externalIdValue, body) {
  // Example:
  // PATCH /services/data/v60.0/sobjects/Survey__c/Survey_Response_ID__c/<externalIdValue>
  const url = `${instanceUrl}/services/data/v60.0/sobjects/${encodeURIComponent(sobject)}/${encodeURIComponent(externalFieldApiName)}/${encodeURIComponent(String(externalIdValue))}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Sforce-Auto-Assign": "FALSE",
    },
    body: JSON.stringify(body),
  });

  if (r.status === 204) {
    // Updated existing record (no body)
    return { ok: true, action: "updated" };
  }

  // If created (201) Salesforce returns JSON with id, success, errors
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Upsert failed: ${r.status} ${text}`);
  }
  let data = {};
  try { data = JSON.parse(text); } catch { /* ignore */ }
  return { ok: true, action: "created", id: data.id };
}

/** ---------- Utility ---------- */
function isoOrNull(ts) {
  try {
    if (ts?.toDate?.()) return ts.toDate().toISOString();
    if (typeof ts === "string" || typeof ts === "number" || ts instanceof Date) return new Date(ts).toISOString();
  } catch {}
  return null;
}

/**
 * POST /api/salesforce/ingest
 * body: { orgId, surveyId, projectId, responseId }
 * Writes into Salesforce object: Survey__c
 * External ID field used for upsert: Survey_Response_ID__c (must be marked External ID in Salesforce)
 * Fields expected on Survey__c: Survey_Response_ID__c (External ID), Survey_Name__c, Survey_Response_Date__c, Survey_Data__c (Long Text)
 */
export async function POST(request) {
  let bodyParams = {};
  try {
    const { db } = initAdmin();
    bodyParams = await request.json();
    const { orgId, surveyId, projectId, responseId } = bodyParams;

    if (!orgId || !surveyId || !projectId || !responseId) {
      return NextResponse.json(
        { ok: false, message: "orgId, surveyId, projectId, responseId are required" },
        { status: 400 }
      );
    }

    // Load response doc
    const ref = db
      .collection("organizations").doc(orgId)
      .collection("surveys").doc(surveyId)
      .collection("responses").doc(responseId);

    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, message: "Response not found" }, { status: 404 });
    }
    const response = snap.data();

    // Build Salesforce payload
    const sfPayload = {
      Survey_Response_ID__c: responseId,
      Survey_Name__c: surveyId,
      Survey_Response_Date__c: new Date().toISOString(),
      Survey_Data__c: JSON.stringify(
        {
          orgId,
          projectId,
          surveyId,
          responseId,
          createdAt: isoOrNull(response?.createdAt),
          contact: response?.contact ?? null,
          answers: response?.answers ?? [],
        },
        null,
        2
      ),
    };

    // Auth
    const { accessToken, instanceUrl } = await getSalesforceAccess();

    // UPSERT by External ID (no pre-query needed)
    const upsert = await sfUpsertExternalId(
      instanceUrl,
      accessToken,
      "Survey__c",
      "Survey_Response_ID__c",
      responseId,
      sfPayload
    );

    // Mark sync status in Firestore
    await ref.set(
      {
        salesforce_processed: true,
        salesforce_id: upsert?.id || admin.firestore.FieldValue.delete(),
        salesforce_synced_at: admin.firestore.FieldValue.serverTimestamp(),
        salesforce_action: upsert.action,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      action: upsert.action,
      id: upsert.id,
      message:
        upsert.action === "created"
          ? "Survey response created in Salesforce"
          : "Survey response updated in Salesforce",
    });
  } catch (err) {
    console.error("Salesforce ingest error:", err?.message || err);

    // best-effort error log to Firestore
    try {
      const { db } = initAdmin();
      const { orgId, surveyId, responseId } = bodyParams || {};
      if (orgId && surveyId && responseId) {
        await db
          .collection("organizations").doc(orgId)
          .collection("surveys").doc(surveyId)
          .collection("responses").doc(responseId)
          .set(
            {
              salesforce_error: true,
              salesforce_error_message: String(err?.message || err),
              salesforce_error_at: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
    } catch (e) {
      // ignore
    }

    return NextResponse.json(
      {
        ok: false,
        message: err?.message || "Server error",
        // reveal stack only in dev
        error: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
