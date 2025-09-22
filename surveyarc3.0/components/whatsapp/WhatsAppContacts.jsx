"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";
import WhatsAppSavedListSidebar from "./WhatsAppSavedListSidebar";

const toE164 = (raw, defaultCountry = "+91") => {
  if (!raw) return "";
  let s = String(raw).replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) s = defaultCountry + s;
  return s;
};

const slugify = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 64) || `list-${Date.now()}`;

export default function WhatsAppContacts() {
  const { orgId } = useRouteParams();

  const [lists, setLists] = useState([]);
  const [selectedListIds, setSelectedListIds] = useState([]);
  const [selectedListContacts, setSelectedListContacts] = useState([]);
  const [loadingListContacts, setLoadingListContacts] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [listName, setListName] = useState("");
  const [parsedContacts, setParsedContacts] = useState([]);
  const [error, setError] = useState("");
  const [allContacts, setAllContacts] = useState([]);

  // fetch ALL contacts (for "All Contacts" view)
  const fetchAllContacts = useCallback(async () => {
    const snap = await getDocs(collection(db, "organizations", orgId, "whatsappContacts"));
    const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    fetched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setAllContacts(fetched);
  }, [orgId]);

  // fetch lists
  const fetchLists = useCallback(async () => {
    const snap = await getDocs(collection(db, "organizations", orgId, "whatsappLists"));
    const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    fetched.sort(
      (a, b) =>
        (b.createdAt || 0) - (a.createdAt || 0) ||
        String(a.listName).localeCompare(String(b.listName))
    );
    setLists(fetched);
  }, [orgId]);

  // fetch contacts in selected lists
  const fetchSelectedListsContacts = useCallback(async (listIds) => {
    if (!listIds?.length) {
      setSelectedListContacts([]);
      return;
    }
    setLoadingListContacts(true);
    try {
      const contacts = [];
      for (const listId of listIds) {
        const listSnap = await getDoc(doc(db, "organizations", orgId, "whatsappLists", listId));
        if (listSnap.exists()) {
          const { contactIds = [] } = listSnap.data();
          for (const cid of contactIds) {
            const cSnap = await getDoc(doc(db, "organizations", orgId, "whatsappContacts", cid));
            if (cSnap.exists()) {
              contacts.push({ id: cSnap.id, ...cSnap.data() });
            }
          }
        }
      }
      const unique = Array.from(new Map(contacts.map(c => [c.id, c])).values());
      setSelectedListContacts(unique);
    } finally {
      setLoadingListContacts(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchAllContacts();
    fetchLists();
  }, [fetchAllContacts, fetchLists]);

  useEffect(() => {
    fetchSelectedListsContacts(selectedListIds);
  }, [selectedListIds, fetchSelectedListsContacts]);

  // -------- helpers for upserting contacts & lists -------
  const findContactByPhone = async (phone) => {
    const snap = await getDocs(collection(db, "organizations", orgId, "whatsappContacts"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).find(c => c.phone === phone);
  };

  const upsertContacts = async (contacts) => {
    const ids = [];
    for (const c of contacts) {
      if (!c.phone) continue;
      const existing = await findContactByPhone(c.phone);
      if (existing) {
        await updateDoc(doc(db, "organizations", orgId, "whatsappContacts", existing.id), {
          ...existing,
          ...c,
          updatedAt: serverTimestamp(),
        });
        ids.push(existing.id);
      } else {
        const newRef = doc(collection(db, "organizations", orgId, "whatsappContacts"));
        await setDoc(newRef, {
          name: c.name || "",
          phone: c.phone,
          tags: c.tags || [],
          createdAt: serverTimestamp(),
        });
        ids.push(newRef.id);
      }
    }
    return ids;
  };

  const upsertListWithContacts = async (name, contacts) => {
    const contactIds = await upsertContacts(contacts);
    const listId = slugify(name);
    await setDoc(doc(db, "organizations", orgId, "whatsappLists", listId), {
      listName: name,
      contactIds,
      createdAt: Date.now(),
    });
    return listId;
  };

  // -------- file parsing & upload ----------
  const parseFile = (file) =>
    new Promise((resolve, reject) => {
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "csv") {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => resolve(res.data),
          error: reject,
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const wb = XLSX.read(e.target.result, { type: "binary" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(sheet));
        };
        reader.readAsBinaryString(file);
      } else {
        reject(new Error("Unsupported file type"));
      }
    });

  const handleFileUpload = async () => {
    if (!listName || parsedContacts.length === 0) {
      setError("Please provide list name and contacts");
      return;
    }
    try {
      await upsertListWithContacts(listName, parsedContacts);
      await fetchAllContacts();
      await fetchLists();
      setUploaderOpen(false);
      setListName("");
      setParsedContacts([]);
      setError("");
    } catch (e) {
      console.error("Upload failed", e);
      setError("Upload failed");
    }
  };

  // -------- UI helpers ----------
  const currentList = useMemo(
    () => lists.find((l) => l.id === selectedListIds[0]) || null,
    [lists, selectedListIds]
  );

  const removeContactFromCurrentList = async (contactId) => {
    const l = currentList;
    if (!l) return;
    const remaining = (l.contactIds || []).filter(id => id !== contactId);
    await updateDoc(doc(db, "organizations", orgId, "whatsappLists", l.id), { contactIds: remaining });
    await fetchSelectedListsContacts([l.id]);
    await fetchLists();
  };

  return (
    <div className="flex gap-6 p-4">
      <WhatsAppSavedListSidebar
        lists={lists}
        selectedListIds={selectedListIds}
        onToggle={(id) => {
          setSelectedListIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
          );
        }}
        onCreate={async (name) => {
          const id = slugify(name);
          await setDoc(doc(db, "organizations", orgId, "whatsappLists", id), {
            listName: name,
            contactIds: [],
            createdAt: Date.now(),
          });
          await fetchLists();
        }}
        onRename={async (id, newName) => {
          await updateDoc(doc(db, "organizations", orgId, "whatsappLists", id), {
            listName: newName,
          });
          await fetchLists();
        }}
        onDelete={async (id) => {
          await deleteDoc(doc(db, "organizations", orgId, "whatsappLists", id));
          setSelectedListIds(prev => prev.filter(x => x !== id));
          await fetchLists();
        }}
        onViewAllContacts={() => setSelectedListIds([])}
      />

      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUploaderOpen(true)}
              className="px-5 py-3 bg-blue-600 text-white rounded-lg"
            >
              📤 Upload WhatsApp Contacts (CSV/XLSX)
            </button>
            <button
              onClick={fetchAllContacts}
              className="px-4 py-3 border rounded-lg"
            >
              Refresh
            </button>
          </div>
          <div className="text-sm text-gray-500">
            {selectedListIds.length
              ? `Viewing ${selectedListContacts.length} contact(s) in selected list(s)`
              : `All contacts: ${allContacts.length}`}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h4 className="font-semibold">
            {selectedListIds.length ? (currentList?.listName || "Selected Lists") : "All Contacts"}
          </h4>

          {/* table */}
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full border border-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border w-14">#</th>
                  <th className="px-4 py-2 border text-left">Name</th>
                  <th className="px-4 py-2 border text-left">Phone</th>
                  <th className="px-4 py-2 border text-left">Tags</th>
                  {selectedListIds.length ? <th className="px-4 py-2 border w-40">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {(selectedListIds.length ? selectedListContacts : allContacts).map((c, idx) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border text-center">{idx + 1}</td>
                    <td className="px-4 py-2 border">{c.name || "-"}</td>
                    <td className="px-4 py-2 border">{c.phone}</td>
                    <td className="px-4 py-2 border">{Array.isArray(c.tags) ? c.tags.join(", ") : "-"}</td>
                    {selectedListIds.length ? (
                      <td className="px-4 py-2 border">
                        <button
                          onClick={() => removeContactFromCurrentList(c.id)}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded"
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {(!selectedListIds.length && allContacts.length === 0) ||
                (selectedListIds.length && selectedListContacts.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">No contacts</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Uploader Modal */}
      {uploaderOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Upload WhatsApp Contacts</h3>

            <div className="space-y-4">
              <input
                type="text"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="New List Name (will be created)"
                className="w-full border rounded px-3 py-2"
              />

              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const rows = await parseFile(file);
                      // expected columns: Name / Phone / Tags (optional)
                      const mapped = rows
                        .map((row) => {
                          const name = row.Name || row.name || "";
                          const phone = toE164(row.Phone || row.phone || "");
                          const tags = (row.Tags || row.tags || "")
                            .toString()
                            .split(",")
                            .map(t => t.trim())
                            .filter(Boolean);
                          if (!phone) return null;
                          return { name, phone, tags };
                        })
                        .filter(Boolean);

                      // de-duplicate by phone
                      const unique = Array.from(new Map(mapped.map(m => [m.phone, m])).values());
                      setParsedContacts(unique);
                      setError("");
                    } catch (err) {
                      console.error("Parse failed", err);
                      setError("Failed to parse file");
                    }
                  }
                }}
              />

              {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>

            {parsedContacts.length > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto border rounded p-2 text-sm">
                {parsedContacts.slice(0, 10).map((c, i) => (
                  <div key={i}>
                    {c.name || "(no name)"} — {c.phone} {c.tags?.length ? `— [${c.tags.join(", ")}]` : ""}
                  </div>
                ))}
                {parsedContacts.length > 10 && (
                  <p className="text-gray-500">
                    +{parsedContacts.length - 10} more...
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setUploaderOpen(false)} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button onClick={handleFileUpload} className="px-4 py-2 bg-blue-600 text-white rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
