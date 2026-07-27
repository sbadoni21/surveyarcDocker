"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useRBAC } from "@/providers/RBACProvider";

/* ----------------------------------
   Helpers
---------------------------------- */
const uniq = (arr) => Array.from(new Set(arr));

export default function AddUserModal({ orgId, onClose, onCreated, userId }) {
  const { adminCreateUser } = useUser();
  const { grantPermission, denyPermission } = useRBAC();

  /* ----------------------------------
     State
  ---------------------------------- */
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    password: "",
    role_id: "",
  });

  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);

  const [rolePermissions, setRolePermissions] = useState([]);
  const [extraPermissions, setExtraPermissions] = useState([]);
  const [removedPermissions, setRemovedPermissions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* ----------------------------------
     Load roles & permissions
  ---------------------------------- */
  useEffect(() => {
    if (!orgId) return;

    const load = async () => {
      // Roles
      const r = await fetch(
        `/api/post-gres-apis/rbac/roles?org_id=${orgId}&user=${userId}`,
        { cache: "no-store" }
      );
      setRoles(await r.json());
      console.log(roles)
      // Permissions
      const p = await fetch(
        `/api/post-gres-apis/rbac/permissions?orgId=${orgId}&user=${userId}`,
        { cache: "no-store" }
      );
      setAllPermissions(await p.json());
    };

    load();
  }, [orgId]);

  /* ----------------------------------
     Load permissions of selected role
  ---------------------------------- */
  useEffect(() => {
    if (!form.role_id) {
      setRolePermissions([]);
      return;
    }

    const loadRolePerms = async () => {
      const res = await fetch(
        `/api/post-gres-apis/rbac/permissions/roles/${form.role_id}/permissions?user=${userId}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setRolePermissions(data.map((p) => p.code));
      setExtraPermissions([]);
      setRemovedPermissions([]);
    };

    loadRolePerms();
  }, [form.role_id]);

  /* ----------------------------------
     Toggle permissions
  ---------------------------------- */
  const toggleExtra = (code) => {
    setExtraPermissions((p) =>
      p.includes(code) ? p.filter((x) => x !== code) : [...p, code]
    );
  };

  const toggleRemove = (code) => {
    setRemovedPermissions((p) =>
      p.includes(code) ? p.filter((x) => x !== code) : [...p, code]
    );
  };

  /* ----------------------------------
     Submit
  ---------------------------------- */
  const submit = async () => {
    setLoading(true);
    setError(null);

    try {
      const role = roles.find((r) => r.id === form.role_id);

      // 1️⃣ Create user
      const user = await adminCreateUser({
        current_user_id: userId,
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        role: role.name,
        orgId: orgId,
        status: "active",
      });

      // // 2️⃣ Assign role
      // await assignRole({
      //   userId: user.uid,
      //   createdBy: userId,
      //   roleName: role.name,
      //   scope: role.scope,
      //   resourceId: orgId,
      //   orgId,
      // });

      // 3️⃣ Grant extra permissions
      for (const p of extraPermissions) {
        await grantPermission({
          userId: user.uid,
          permissionCode: p,
          scope: p.scope,
          resourceId: orgId,
        });
      }

      // 4️⃣ Deny removed permissions
      for (const p of removedPermissions) {
        await denyPermission({
          userId: user.uid,
          permissionCode: p,
          scope: p.scope,
          resourceId: orgId,
          reason: "Removed during user creation",
        });
      }

      onCreated();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------
     Derived permissions
  ---------------------------------- */
  const effectivePreview = uniq([
    ...rolePermissions.filter((p) => !removedPermissions.includes(p)),
    ...extraPermissions,
  ]);

  /* ----------------------------------
     UI
  ---------------------------------- */
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50  p-4">
      <div className="bg-white w-full max-w-lg rounded shadow p-6 space-y-4 ">
        <h2 className="text-lg font-semibold">Add New User</h2>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        <input
          className="w-full border p-2 rounded"
          placeholder="Email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          placeholder="Display Name"
          value={form.displayName}
          onChange={(e) => update("displayName", e.target.value)}
        />

        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="Password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
        />

        {/* ROLE */}
        <select
          className="w-full border p-2 rounded"
          value={form.role_id}
          onChange={(e) => update("role_id", e.target.value)}
        >
          <option value="">Select role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* PERMISSIONS */}
        {form.role_id && (
          <div className="border rounded p-3 space-y-2 text-sm ">
            <h3 className="font-medium">Permissions</h3>

            {allPermissions.map((p) => {
              const inherited = rolePermissions.includes(p.code);
              const removed = removedPermissions.includes(p.code);
              const extra = extraPermissions.includes(p.code);

              return (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={effectivePreview.includes(p.code)}
                    onChange={() =>
                      inherited
                        ? toggleRemove(p.code)
                        : toggleExtra(p.code)
                    }
                  />
                  <span>
                    {p.code}
                    {inherited && !removed && (
                      <span className="ml-2 text-xs text-gray-500">
                        (role)
                      </span>
                    )}
                    {extra && (
                      <span className="ml-2 text-xs text-blue-600">
                        (extra)
                      </span>
                    )}
                    {removed && (
                      <span className="ml-2 text-xs text-red-600">
                        (removed)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={submit}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? "Creating…" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}
