"use client";
import React, { useMemo, useState } from "react";
import { X, Search } from "lucide-react";

export default function AllContactsDialog({
  contacts = [],
  onClose,
  onRefresh,
  onAddToList,
  onSave,           // (contactId, updates)
  onDelete,        // (contactId)
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter(
      (c) =>
        String(c.name || "").toLowerCase().includes(s) ||
        String(c.email || "").toLowerCase().includes(s)
    );
  }, [q, contacts]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const startEdit = (c) => {
    setEditing(c.id);
    setName(c.name || "");
    setEmail(c.email || "");
  };

  const saveEdit = async () => {
    await onSave(editing, { name: name.trim(), email: email.trim() });
    await onRefresh();
    setEditing(null);
  };

  const addSelected = async () => {
    if (selected.size === 0) return;
    await onAddToList(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 p-6 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="border rounded px-2 py-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addSelected}
              className="px-3 py-2 text-sm rounded bg-gray-900 text-white hover:bg-black/80"
            >
              Add Selected to List
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Sel</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Email</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase border-b">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => {
                const isEditing = editing === c.id;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      ) : (
                        <span>{c.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      ) : (
                        <span className="text-blue-600">{c.email}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="px-2 py-1 border rounded">Save</button>
                          <button onClick={() => setEditing(null)} className="px-2 py-1 border rounded">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(c)} className="px-2 py-1 border rounded">Edit</button>
                          <button onClick={() => onDelete(c.id)} className="px-2 py-1 bg-red-600 text-white rounded">
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">No contacts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
