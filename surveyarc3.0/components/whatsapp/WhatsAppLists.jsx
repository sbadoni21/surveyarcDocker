"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";

export default function WhatsAppLists() {
  const { orgId } = useRouteParams();
  const [lists, setLists] = useState([]);

  const fetchLists = async () => {
    const snap = await getDocs(collection(db, "organizations", orgId, "whatsappLists"));
    const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    fetched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setLists(fetched);
  };

  useEffect(() => { fetchLists(); }, []);

  const rename = async (id, newName) => {
    await updateDoc(doc(db, "organizations", orgId, "whatsappLists", id), { listName: newName });
    await fetchLists();
  };

  const remove = async (id) => {
    await deleteDoc(doc(db, "organizations", orgId, "whatsappLists", id));
    await fetchLists();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4">WhatsApp Lists</h2>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border text-left">List Name</th>
              <th className="px-4 py-2 border text-left">Contacts</th>
              <th className="px-4 py-2 border w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lists.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{l.listName}</td>
                <td className="px-4 py-2 border">{(l.contactIds || []).length}</td>
                <td className="px-4 py-2 border">
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const nn = prompt("Rename list to:", l.listName);
                        if (nn && nn.trim()) await rename(l.id, nn.trim());
                      }}
                      className="px-3 py-1 rounded border"
                    >
                      Rename
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Delete this list?")) await remove(l.id);
                      }}
                      className="px-3 py-1 rounded bg-red-600 text-white"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {lists.length === 0 && (
              <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={3}>No lists yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
