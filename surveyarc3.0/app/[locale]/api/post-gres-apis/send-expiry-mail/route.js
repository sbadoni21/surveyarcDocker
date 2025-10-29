import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req) {
const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

  try {
    const body = await req.json();
    const { orgId, orgName, expiryDate, daysRemaining } = body;

    if (!orgId || !orgName || !expiryDate) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const res = await fetch(`${BASE}/organisation/${orgId}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: "Organisation not found" },
        { status: 404 }
      );
    }

    const orgData = await res.json();
    const adminEmail = orgData?.owner_email; // adjust field name to match API response

    if (!adminEmail) {
      return NextResponse.json(
        { success: false, message: "No admin email found for org" },
        { status: 404 }
      );
    }

    // 🔹 Setup mail transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Support Team" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `⚠️ Subscription Expiry Reminder - ${orgName}`,
      html: `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Subscription Expiry Reminder</title>
    </head>
    <body style="margin:0; padding:0; font-family: Arial, sans-serif; background:#ed7a13; color:#333;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f9fafb; padding:30px 0;">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td align="center" style="background:#2563eb; padding:20px;">
                  <h1 style="margin:0; font-size:22px; font-weight:600; color:#ffffff;">
                    ⚠️ Subscription Expiry Reminder
                  </h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:30px;">
                  <h2 style="margin:0 0 15px 0; font-size:18px; font-weight:600; color:#111;">
                    Dear ${orgName},
                  </h2>
                  <p style="margin:0 0 10px 0; font-size:15px; line-height:22px;">
                    Your subscription of surveyarc will expire in 
                    <b style="color:#dc2626;">${daysRemaining} day${
        daysRemaining > 1 ? "s" : ""
      }</b>.
                  </p>
                  <p style="margin:0 0 10px 0; font-size:15px; line-height:22px;">
                    <b>Expiry Date:</b> ${new Date(
                      expiryDate
                    ).toLocaleDateString()}
                  </p>
                  <p style="margin:0 0 20px 0; font-size:15px; line-height:22px;">
                    Please renew or upgrade your plan to avoid service interruption.
                  </p>
                  
                  <a href="https://surveyarc-docker.vercel.app/en/org/${orgId}/dashboard" 
                     style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 20px; font-size:15px; border-radius:6px;">
                    Renew Subscription
                  </a>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:20px; background:#f3f4f6; text-align:center; font-size:13px; color:#6b7280;">
                  Regards,<br/>Support Team<br/>
                  <a href="https://surveyarc-docker.vercel.app" style="color:#2563eb; text-decoration:none;">surveyarc.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: "Mail sent",
      to: adminEmail,
    });
  } catch (error) {
    console.error("Mail sending failed:", error);
    return NextResponse.json(
      { success: false, message: "Mail error", error: error.message },
      { status: 500 }
    );
  }
}
