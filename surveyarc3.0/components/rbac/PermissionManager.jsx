"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit, Shield, Loader2, X } from "lucide-react";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

export default function PermissionManager({orgId}) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    code: "",
    module: "",
    description: "",
  });
  const {user} = useUser();
  const userId= user?.uid
  console.log(userId)
  // =========================
  // LOAD PERMISSIONS
  // =========================
const loadPermissions = async () => {
  if (!user?.uid) return;   // ⛔ DOUBLE SAFETY

  setLoading(true);
  const res = await fetch(
    `/api/post-gres-apis/rbac/permissions?user=${user.uid}&orgId=${orgId}`,
    { cache: "no-store" }
  );

  const data = await res.json();
  setPermissions(data || []);
  setLoading(false);
};


  useEffect(() => {
    loadPermissions();
  }, [user]);

  // =========================
  // CREATE / UPDATE
  // =========================
  const submit = async () => {
    const method = editing ? "PUT" : "POST";
    const url = editing
      ? `/api/post-gres-apis/rbac/permissions/${editing.id}`
      : `/api/post-gres-apis/rbac/permissions`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, user_id: userId }),
    });

    if (res.ok) {
      setForm({ code: "", module: "", description: "" });
      setEditing(null);
      setShowCreate(false);
      loadPermissions();
    }
  };

  // =========================
  // DELETE
  // =========================
  const remove = async (id) => {
    if (!confirm("Delete this permission?")) return;
    await fetch(`/api/post-gres-apis/rbac/permissions/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    loadPermissions();
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="text-orange-500" /> RBAC Permissions
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg flex items-center gap-2"
        >
          <Plus size={16} /> Create Permission
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin" size={40} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border rounded-lg">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Module</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-mono text-sm">{p.code}</td>
                  <td className="p-3">{p.module}</td>
                  <td className="p-3 text-sm text-gray-600">{p.description || "—"}</td>
                  <td className="p-3 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditing(p);
                        setForm(p);
                        setShowCreate(true);
                      }}
                      className="p-2 rounded bg-blue-100 text-blue-700"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="p-2 rounded bg-red-100 text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-xl p-6">
            <div className="flex justify-between mb-4">
              <h2 className="font-semibold text-lg">
                {editing ? "Edit Permission" : "Create Permission"}
              </h2>
              <button onClick={() => setShowCreate(false)}>
                <X />
              </button>
            </div>

            <div className="space-y-3">
              <input
                placeholder="permission.code"
                className="w-full px-3 py-2 border rounded"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <input
                placeholder="module"
                className="w-full px-3 py-2 border rounded"
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
              />
              <textarea
                placeholder="description"
                className="w-full px-3 py-2 border rounded"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <button
              onClick={submit}
              className="mt-4 w-full bg-orange-500 text-white py-2 rounded"
            >
              {editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
