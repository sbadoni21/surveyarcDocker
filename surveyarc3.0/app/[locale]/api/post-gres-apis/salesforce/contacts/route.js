// app/api/salesforce/contacts/route.js

export async function GET(request) {
  try {
    const TOKEN_URL =
      process.env.SALESFORCE_TOKEN_URL ||
      "https://login.salesforce.com/services/oauth2/token";
    const CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
    const CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
    const USERNAME = process.env.SALESFORCE_USERNAME;
    const PASSWORD = process.env.SALESFORCE_PASSWORD;
    const APEX_CONTACTS_URL = process.env.SALESFORCE_APEX_CONTACTS_URL;

    if (!CLIENT_ID || !CLIENT_SECRET || !USERNAME || !PASSWORD || !APEX_CONTACTS_URL) {
      return new Response(
        JSON.stringify({
          error:
            "Missing Salesforce env vars (CLIENT_ID / CLIENT_SECRET / USERNAME / PASSWORD / APEX_CONTACTS_URL)",
        }),
        { status: 500 }
      );
    }

    // optional limit param: /api/salesforce/contacts?limit=50
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) || 50 : 50;

    // 1) Get OAuth token (same as Postman: grant_type = password)
    const tokenBody = new URLSearchParams({
      grant_type: "password",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: USERNAME,
      password: PASSWORD,
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
    });

    const tokenText = await tokenRes.text();

    if (!tokenRes.ok) {
      console.error("Salesforce OAuth error:", tokenText);
      return new Response(
        JSON.stringify({
          error: "Failed to get Salesforce access token",
          details: tokenText,
        }),
        { status: 500 }
      );
    }

    const tokenJson = JSON.parse(tokenText);
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "Salesforce auth response missing access_token",
          details: tokenJson,
        }),
        { status: 500 }
      );
    }

    // 2) Call your Apex REST URL to fetch contacts
    const sfRes = await fetch(APEX_CONTACTS_URL, {
      method: "POST", // your Apex uses @HttpPost
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit }),
    });

    const sfText = await sfRes.text();

    if (!sfRes.ok) {
      console.error("Apex REST error:", sfText);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch contacts from Salesforce Apex REST",
          details: sfText,
        }),
        { status: 500 }
      );
    }

    // Apex returns JSON array (List<ContactResponse>)
    return new Response(sfText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error in /api/salesforce/contacts:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Internal server error" }),
      { status: 500 }
    );
  }
}
