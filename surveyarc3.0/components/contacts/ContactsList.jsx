"use client";

import { useState, useMemo } from "react";
import React from "react";
import { Pencil, Trash, User, Mail, Phone, X } from "lucide-react";

export default function ContactsList({
  contacts = [],
  lists = [],
  loading,
  onCreate,
  onUpdate,
  onDelete,
  onAddToList,
  onRemoveFromList,
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Debug logging
  console.log("Contacts received:", contacts);
  console.log("Lists received:", lists);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const matchString =
        `${c.name} ${(c.emails ?? []).map((e) => e.email).join(" ")}`.toLowerCase();
      return matchString.includes(search.toLowerCase());
    });
  }, [search, contacts]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let A = a[sortKey] ?? "";
      let B = b[sortKey] ?? "";

      if (sortKey === "created_at") {
        A = new Date(A);
        B = new Date(B);
      } else {
        A = A.toString().toLowerCase();
        B = B.toString().toLowerCase();
      }

      if (A < B) return sortOrder === "asc" ? -1 : 1;
      if (A > B) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortOrder]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [page, sorted]);

  const totalPages = Math.ceil(sorted.length / pageSize);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortOrder((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="w-full p-4">
      {/* SEARCH BAR */}
      <div className="flex justify-between mb-4">
        <input
          placeholder="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto border rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th 
                onClick={() => toggleSort("name")} 
                className="py-3 px-4 cursor-pointer text-left font-semibold hover:bg-gray-200"
              >
                Name {sortKey === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="py-3 px-4 text-left font-semibold">Email</th>
              <th className="py-3 px-4 text-left font-semibold">Phone</th>
              <th className="py-3 px-4 text-left font-semibold">Lists</th>
              <th 
                onClick={() => toggleSort("created_at")} 
                className="py-3 px-4 cursor-pointer text-left font-semibold hover:bg-gray-200"
              >
                Created {sortKey === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="py-3 px-4 text-left font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginated.length > 0 && paginated.map((c) => {
              // Ensure lists is always an array
              const contactLists = Array.isArray(c.lists) ? c.lists : [];
              
              // Debug log for each contact
              console.log(`Contact ${c.contact_id} (${c.name}):`, contactLists);
              
              const availableLists = lists.filter(
                (l) => !contactLists.some((x) => x.list_id === l.list_id)
              );

              return (
                <React.Fragment key={c.contact_id}>
                <tr className="border-b hover:bg-gray-50 transition-colors">
                  {/* NAME */}
                  <td className="py-3 px-4">
                    <div className="flex gap-2 items-center">
                      <User size={16} className="text-gray-500 flex-shrink-0" />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>

                  {/* EMAIL */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Mail size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm truncate">{c.emails?.[0]?.email ?? "-"}</span>
                    </div>
                  </td>

                  {/* PHONE */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-gray-700">
                      <Phone size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm">{c.phones?.[0]?.phone_number ?? "-"}</span>
                    </div>
                  </td>

                  {/* LISTS */}
                  <td className="py-3 px-4">
                    <div className="flex gap-2 flex-wrap items-center min-w-[200px]">
                      {contactLists.length > 0 ? (
                        <>
                          {contactLists.map((l) => (
                            <span
                              key={l.list_id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              <span className="font-medium">{l.list_name}</span>
                              <button
                                className="text-blue-500 hover:text-red-600 transition-colors ml-1"
                                onClick={() => {
                                  console.log('Removing from list:', l.list_id, c.contact_id);
                                  onRemoveFromList(l.list_id, [c.contact_id]);
                                }}
                                title="Remove from list"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Not in any list</span>
                      )}

                      {/* ADD TO LIST DROPDOWN */}
                      {availableLists.length > 0 && (
                        <select
                          className="text-xs border rounded px-2 py-1 bg-white hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onChange={(e) => {
                            const listId = e.target.value;
                            if (listId) {
                              console.log('Adding to list:', listId, c.contact_id);
                              onAddToList(listId, [c.contact_id]);
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="">+ Add to list</option>
                          {availableLists.map((l) => (
                            <option key={l.list_id} value={l.list_id}>
                              {l.list_name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>

                  {/* CREATED */}
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>

                  {/* ACTIONS */}
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onUpdate(c.contact_id, c)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                        title="Edit contact"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        onClick={() => onDelete(c.contact_id)}
                        className="p-1.5 text-red-600 rounded hover:bg-red-50 transition-colors"
                        title="Delete contact"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                </React.Fragment>
              );
            })}

            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No contacts found
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  Loading contacts...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-4 gap-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}