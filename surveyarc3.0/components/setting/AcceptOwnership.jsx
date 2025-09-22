"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";

export default function AcceptOwnership() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const email = searchParams.get("email");

  useEffect(() => {
    const acceptOwnership = async () => {
      try {
        const response = await axios.post("/api/ownership-transfer/accept", {
          orgId,
          email,
        });
        alert(response.data.message);
      } catch (err) {
        alert("Failed to accept ownership.");
      }
    };

    if (orgId && email) acceptOwnership();
  }, [orgId, email]);

  return <div className="p-6 text-slate-700">Processing ownership acceptance...</div>;
}
