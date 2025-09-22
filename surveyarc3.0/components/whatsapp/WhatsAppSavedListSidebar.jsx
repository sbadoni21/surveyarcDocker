"use client";

import React, { useState } from "react";

export default function WhatsAppSavedListSidebar({
  lists,
  selectedListIds,
  onToggle,
  onCreate,
  onRename,
  onDelete,
  onViewAllContacts,
}) {
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  return (
    <aside className="w-72 shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Lists</h3>
        <button
          onClick={() => setNewListOpen(true)}
          className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
        >
          + New
        </button>
      </div>

      <button
        className={`w-full text-left px-3 py-2 rounded mb-1 ${
          selectedListIds.length === 0 ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
        }`}
        onClick={onViewAllContacts}
      >
        All Contacts
      </button>

      <div className="max-h-[60vh] overflow-y-auto">
        {lists.map((l) => {
          const active = selectedListIds.includes(l.id);
          return (
            <div key={l.id} className={`group flex items-center justify-between px-2 py-1 rounded ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}>
              <button
                onClick={() => onToggle(l.id)}
                className="flex-1 text-left py-2 px-1"
                title={`${l.listName} (${(l.contactIds || []).length})`}
              >
                <div className="text-sm font-medium truncate">{l.listName}</div>
                <div className="text-xs text-gray-500">{(l.contactIds || []).length} contact(s)</div>
              </button>
              <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                <button
                  onClick={async () => {
                    const nn = prompt("Rename list to:", l.listName);
                    if (nn && nn.trim()) await onRename(l.id, nn.trim());
                  }}
                  className="px-2 py-1 text-xs border rounded"
                >
                  Rename
                </button>
                <button
                  onClick={async () => {
                    if (confirm("Delete this list?")) await onDelete(l.id);
                  }}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {lists.length === 0 && (
          <div className="text-xs text-gray-500 px-2 py-2">No lists yet.</div>
        )}
      </div>

      {/* New list modal */}
      {newListOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h4 className="font-semibold mb-3">Create New List</h4>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="List name"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNewListOpen(false)} className="px-3 py-2 border rounded">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newListName.trim()) return;
                  await onCreate(newListName.trim());
                  setNewListName("");
                  setNewListOpen(false);
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
