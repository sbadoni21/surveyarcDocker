"use client";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import React, { useState } from "react";
import { ImWarning } from "react-icons/im";

export default function OwnerShipTransfer({ orgData }) {
  const [selectedEmail, setSelectedEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const { user } = useUser();

  const handleInvite = async () => {
    if (!selectedEmail || !orgData?.uid || !user?.email) {
      alert("Please select a valid user and make sure org data is loaded.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to transfer ownership to ${selectedEmail}?`
    );
    if (!confirmed) return;

    const payload = {
      email: selectedEmail,
      role: "owner",
      displayName: user.displayName,
      inviteLink: `https://surveyarc-docker.vercel.app/accept-transfer?orgId=${orgData?.uid}&email=${selectedEmail}`,
      orgId: orgData?.uid,
      currentOwnerEmail: user.email,
    };

    setIsSending(true); // Start saving state
    try {
      const res = await fetch("/api/ownership-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to send invite");

      alert("Invite sent successfully.");
      setMessage("Ownership transfer invite sent successfully.");
    } catch (err) {
      console.error("Invite error:", err);
      alert(err.message);
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 bg-white dark:bg-[#1A1A1E] p-4 rounded-3xl border dark:border-[#96949C3B] border-[#96949C3B]">
      <div className="flex items-center gap-2">
        <ImWarning className="text-xl text-[#ED7A13]" />
        <h2 className="text-2xl dark:text-[#CBC9DE] text-black font-semibold">
          Transfer Ownership
        </h2>
      </div>
      <p className="text-sm dark:text-[#96949C] text-[#8C8A97]">
        Transfer ownership of this team to another admin member. This action
        cannot be undone.
      </p>
      <div className="flex gap-8 text-sm font-medium">
        <select
          value={selectedEmail}
          onChange={(e) => setSelectedEmail(e.target.value)}
          className="w-fit py-2 px-6 border dark:bg-[#1A1A1E] dark:text-[#5B596A] border-[#8C8A97] rounded-xl"
        >
          <option value="">Select new</option>
          {orgData.teamMembers?.map((member, idx) => (
            <option key={idx} value={member.email}>
              {member.email}
            </option>
          ))}
        </select>

        <button
          onClick={handleInvite}
          disabled={isSending}
          className="border border-[#ED7A13] text-sm font-semibold text-[#ED7A13] px-12 py-2 rounded-xl"
        >
          {isSending ? "Processing..." : "Transfer ownership"}
        </button>
      </div>

      {message && <p className="mt-2 text-sm">{message}</p>}
    </div>
  );
}
