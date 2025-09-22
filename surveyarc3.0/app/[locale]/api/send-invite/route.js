
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
  const { email, role, inviteLink } = await req.json();

  const subject = `You've been invited as a ${role}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
      <h2 style="color: #2c3e50;">You've Been Invited</h2>
      <p>Hello,</p>
      <p>You have been invited to join the platform as a <strong>${role}</strong>.</p>
      <p>Please click the link below to accept the invite:</p>
      <a href="${inviteLink}" style="padding: 10px 20px; background-color: #ED7A13; color: white; border-radius: 5px; text-decoration: none;">
        Accept Invite
      </a>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject,
      html: htmlContent,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Invite sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to send invite",
        error,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
