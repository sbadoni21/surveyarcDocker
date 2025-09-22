import { getFirestore, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase";

const db = getFirestore(firebaseApp);

export async function POST(req) {
  const { orgId, email } = await req.json();

  if (!orgId || !email) {
    return new Response(
      JSON.stringify({ success: false, message: "Missing orgId or email" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const orgRef = doc(db, "organizations", orgId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
      throw new Error("Organization not found");
    }

    const orgData = orgSnap.data();
    const teamMembers = orgData.teamMembers || [];

    const acceptingMember = teamMembers.find((m) => m.email === email);
    const currentOwner = teamMembers.find((m) => m.role === "owner");

    if (!acceptingMember || !currentOwner) {
      throw new Error("Valid recipient or owner not found");
    }

    const updatedTeam = teamMembers.map((m) => {
      if (m.email === email) {
        return { ...m, role: "owner", ownershipStatus: "success" };
      } else if (m.email === currentOwner.email) {
        return { ...m, role: "member", ownershipStatus: "success" };
      } else {
        return m;
      }
    });

    await updateDoc(orgRef, {
      teamMembers: updatedTeam,
      "subscription.currentUsage.teamMembers": increment(1),
    });

    return new Response(
      JSON.stringify({ success: true, message: "Ownership accepted" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Accept ownership error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Something went wrong",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
