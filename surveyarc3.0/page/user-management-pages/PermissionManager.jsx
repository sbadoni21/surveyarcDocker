"use client";
import { useEffect, useState } from "react";

export default function PermissionManager({ orgId }) {
  const [perms, setPerms] = useState([]);

  const load = async () => {
    const res = await fetch(`/api/post-gres-apis/rbac/permissions?orgId=${orgId}`);
    setPerms(await res.json());
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const create = async () => {
    await fetch("/api/post-gres-apis/rbac/permissions", {
      method: "POST",
      body: JSON.stringify({
        code: "example.test",
        module: "example",
        description: "Test permission",
      }),
    });
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/post-gres-apis/rbac/permissions/${id}`, {
      method: "DELETE",
    });
    load();
  };

  return (
    <div>
      <h3>Permissions</h3>
      <button onClick={create}>Create Permission</button>
      {perms.map((p) => (
        <div key={p.id} className="flex gap-2">
          <span>{p.code}</span>
          <button onClick={() => remove(p.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
