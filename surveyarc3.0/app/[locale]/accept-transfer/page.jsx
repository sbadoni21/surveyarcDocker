"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AcceptTransferPage() {
  const params = useSearchParams();
  const orgId = params.get("orgId");
  const email = params.get("email");
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    if (!orgId || !email) return;

    const accept = async () => {
      const res = await fetch("/api/accept-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, email }),
      });

      const result = await res.json();
      setStatus(result.message || "Done");
    };

    accept();
  }, [orgId, email]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 text-center">
        <h1 className="text-xl font-semibold">Accepting Ownership</h1>
        <p className="mt-4">{status}</p>
      </div>
    </div>
  );
}
