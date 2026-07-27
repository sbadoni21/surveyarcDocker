"use client";

import { useEffect, useState } from "react";
import { useRBAC } from "@/providers/RBACProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

export default function InviteUser({ orgId, onCreated }) {
  const { assignRole, listRoles } = useRBAC();
  const {user} = useUser();
console.log(user)
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Load roles from BACKEND
  useEffect(() => {
    if (!orgId) return;

    listRoles(user?.uid, orgId, "org").then((data) => {
      setRoles(data);
      if (data.length > 0) {
        setSelectedRole(data[0].name); // default
      }
    });
  }, [orgId, listRoles, user?.uid]);

  const invite = async () => {
    if (!email || !selectedRole) return;

    setLoading(true);
    try {
      // 1️⃣ Create user
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          orgId,
          role: "member", // legacy User.role, NOT RBAC
        }),
      });

      if (!res.ok) throw new Error("User creation failed");
      const user = await res.json();

      // 2️⃣ Assign RBAC role (REAL AUTH)
      await assignRole({
        userId: user.uid,
        roleName: selectedRole,
        scope: "org",
        resourceId: orgId,
        orgId,
      });

      onCreated?.(user);
      setEmail("");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border p-4 rounded space-y-3">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        className="border p-2 w-full"
      />

      <select
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value)}
        className="border p-2 w-full"
      >
        {roles.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>

      <button
        onClick={invite}
        disabled={loading}
        className="bg-orange-500 text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Inviting..." : "Invite User"}
      </button>
    </div>
  );
}
