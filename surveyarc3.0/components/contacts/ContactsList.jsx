"use client";

import { useState, useMemo } from "react";
import { Pencil, Trash, User, Mail, Phone } from "lucide-react";

export default function ContactsList({
  contacts = [],
  onDelete,
  onEdit,
  pageSize = 10,
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("first_name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const matchString =
        `${c.first_name} ${c.last_name} ${(c.emails ?? [])
          .map((e) => e.email)
          .join(" ")}`.toLowerCase();

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

  // PAGINATE
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
    <div className="p-4 w-full">

      {/* SEARCH */}
      <div className="flex justify-between mb-4">
        <input
          placeholder="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 w-full max-w-xs"
        />
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th
                className="py-2 px-4 cursor-pointer"
                onClick={() => toggleSort("first_name")}
              >
                Name
              </th>
              <th className="py-2 px-4">Email</th>
              <th className="py-2 px-4">Phone</th>
              <th
                className="py-2 px-4 cursor-pointer"
                onClick={() => toggleSort("created_at")}
              >
                Created
              </th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginated.map((contact) => (
              <tr key={contact.contact_id} className="border-b">
                <td className="py-2 px-4 flex gap-2 items-center">
                  <User size={16} />
                  {contact.first_name} {contact.last_name}
                </td>

                <td className="py-2 px-4">
                  <div className="flex items-center gap-1">
                    <Mail size={14} />
                    {contact.emails?.[0]?.email ?? "-"}
                  </div>
                </td>

                <td className="py-2 px-4">
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    {contact.phones?.[0]?.phone ?? "-"}
                  </div>
                </td>

                <td className="py-2 px-4">
                  {new Date(contact.created_at).toLocaleDateString()}
                </td>

                <td className="py-2 px-4 flex gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(contact)}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  {onDelete && (
                    <button
                      onClick={() => onDelete(contact.contact_id)}
                      className="p-1 text-red-600 rounded hover:bg-red-100"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-6 text-gray-500">
                  No contacts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-center mt-4 gap-4">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1 border rounded disabled:opacity-30"
        >
          Previous
        </button>

        <span>
          Page {page} / {totalPages}
        </span>

        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 border rounded disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}
