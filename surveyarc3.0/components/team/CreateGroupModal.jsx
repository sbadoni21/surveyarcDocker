// components/groups/CreateGroupModal.jsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useGroups } from "@/providers/postGresPorviders/GroupProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

const GROUP_TYPES = [
  { value: "team", label: "Team" },
  { value: "security", label: "Security" },
  { value: "integration", label: "Integration" },
  { value: "custom", label: "Custom" },
];

export default function CreateGroupModal({ orgId, onClose, onCreated }) {
  const { createGroup } = useGroups();
  const {uid} = useUser();
  const [form, setForm] = useState({
    name: "",
    description: "",
    orgId: orgId,
    group_type: "team",
    user_id: uid,
    owner_uid:uid,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Group name is required.");
      return;
    }
    if (!orgId) {
      setError("Missing organisation context.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        org_id: orgId,   // 👈 only in payload, never shown
        name: form.name.trim(),
        description: form.description.trim() || null,
        group_type: form.group_type,
        user_id: uid,
        owner_uid:uid,
      };
      await createGroup(payload);
      if (onCreated) await onCreated();
      onClose();
    } catch (err) {
      console.error("CreateGroupModal error:", err);
      setError(err.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#020617] w-full max-w-md rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Create User Group
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={handleChange("name")}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Customer Success Team"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={handleChange("description")}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional: Add a short description"
            />
          </div>

          {/* Group Type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Group Type
            </label>
            <select
              value={form.group_type}
              onChange={handleChange("group_type")}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {GROUP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md text-xs font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
