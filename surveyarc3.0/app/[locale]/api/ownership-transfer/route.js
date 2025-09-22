import nodemailer from "nodemailer";
import { getFirestore, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase";

const db = getFirestore(firebaseApp);

export async function POST(req) {
  const { email, role, inviteLink, orgId, currentOwnerEmail, displayName } =
    await req.json();

  if (!email || !inviteLink || !orgId || !currentOwnerEmail) {
    return new Response(
      JSON.stringify({ success: false, message: "Missing required fields" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: {
        name: "SurveyArc Team",
        address: ` <${process.env.SMTP_USER}> `,
      },
      to: email,
      // cc: ` ${displayName} <${currentOwnerEmail}>`,
      subject: `You've been invited to take ownership`,
      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>Ownership Transfer Invitation</h2>
          <p>You’ve been invited to become the <strong>owner</strong> of the organization.</p>
          <a href="${inviteLink}" style="padding: 10px 20px; background-color: #ED7A13; color: white; text-decoration: none; border-radius: 5px;">
            Accept Ownership
          </a>
        </div>
      `,
    });

    // Update Firestore teamMembers
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
      throw new Error("Organization not found");
    }

    const orgData = orgSnap.data();
    const teamMembers = orgData.teamMembers || [];

    const updatedTeam = teamMembers.map((member) => {
      if (member.email === email || member.email === currentOwnerEmail) {
        return { ...member, ownershipStatus: "pending" };
      }
      return member;
    });

    await updateDoc(orgRef, {
      teamMembers: updatedTeam,
      "subscription.currentUsage.teamMembers": increment(1),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invite sent and status updated",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Ownership transfer error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Transfer failed",
        error: error.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
