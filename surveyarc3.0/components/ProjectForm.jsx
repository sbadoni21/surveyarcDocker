"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getCookie } from "cookies-next";
import { useUser } from "@/providers/postGresPorviders/UserProvider";

const DEFAULT_STATUS = "planning";
const DEFAULT_PRIORITY = "medium";

export default function ProjectForm({
  initialData = {},
  onSubmit,
  onCancel,
  loading,
}) {
  const { getUsersByOrg } = useUser();
  const currentOrgId = getCookie("currentOrgId");
  const currentUserId = getCookie("currentUserId");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [members, setMembers] = useState([]);
  const [orgUsers, setOrgUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = !!(initialData?.project_id || initialData?.projectId);
  const ownerUid =
    initialData?.owner_uid ||
    initialData?.ownerUID ||
    currentUserId ||
    "";

  useEffect(() => {
    const normalizedMembers = (initialData?.members || [])
      .filter((member) => member?.uid && member.uid !== ownerUid)
      .map((member) => ({
        uid: member.uid,
        role: member.role || "contributor",
        status: member.status || "active",
      }));

    setName(initialData?.name || "");
    setDescription(initialData?.description || "");
    setCategory(initialData?.category || "");
    setStatus(initialData?.status || DEFAULT_STATUS);
    setPriority(initialData?.priority || DEFAULT_PRIORITY);
    setStartDate(toDateInputValue(initialData?.start_date || initialData?.startDate));
    setDueDate(toDateInputValue(initialData?.due_date || initialData?.dueDate));
    setTagInput(Array.isArray(initialData?.tags) ? initialData.tags.join(", ") : "");
    setIsPublic(Boolean(initialData?.is_public ?? initialData?.isPublic ?? false));
    setNotificationsEnabled(
      Boolean(initialData?.notifications_enabled ?? initialData?.notificationsEnabled ?? true)
    );
    setMembers(normalizedMembers);
  }, [initialData, ownerUid]);

  useEffect(() => {
    let cancelled = false;

    if (!currentOrgId) {
      setOrgUsers([]);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        setLoadingUsers(true);
        const users = await getUsersByOrg(currentOrgId);
        if (!cancelled) {
          setOrgUsers(Array.isArray(users) ? users : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("[ProjectForm] Failed to load org users:", loadError);
          setOrgUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentOrgId, getUsersByOrg]);

  const availableUsers = useMemo(
    () =>
      (orgUsers || []).filter((user) => {
        const uid = user?.uid || user?.user_id || user?.id;
        return uid && uid !== ownerUid;
      }),
    [orgUsers, ownerUid]
  );

  function handleMemberToggle(uid, checked) {
    setMembers((prev) => {
      if (checked) {
        if (prev.some((member) => member.uid === uid)) return prev;
        return [...prev, { uid, role: "contributor", status: "active" }];
      }
      return prev.filter((member) => member.uid !== uid);
    });
  }

  function handleMemberRoleChange(uid, role) {
    setMembers((prev) =>
      prev.map((member) => (member.uid === uid ? { ...member, role } : member))
    );
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("Directory name is required.");
      return;
    }

    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setError(null);
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      status,
      priority,
      startDate: startDate || null,
      dueDate: dueDate || null,
      tags,
      isPublic,
      notificationsEnabled,
      members,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-orange-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-orange-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? "Edit Directory" : "Create New Directory"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Set the directory basics now, then refine surveys and team access later.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-orange-100 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-100 p-3">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Directory Name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Customer Feedback"
                className={inputClassName}
              />
            </FormField>

            <FormField label="Section / Topic">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Company, product line, campaign, topic"
                className={inputClassName}
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this directory is for and which surveys belong here"
                  rows="3"
                  className={`${inputClassName} resize-none`}
                />
              </FormField>
            </div>

            <FormField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClassName}
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FormField>

            <FormField label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClassName}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </FormField>

            <FormField label="Start Date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClassName}
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Tags">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="feedback, acme, b2b"
                  className={inputClassName}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Separate tags with commas.
                </p>
              </FormField>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-orange-200 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Directory Settings</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50/70 p-3">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded text-orange-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Visible across the organization</p>
                  <p className="text-xs text-gray-500">Use this when more teams should discover it.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50/70 p-3">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded text-orange-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Notifications enabled</p>
                  <p className="text-xs text-gray-500">Keep updates and team activity visible.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-orange-200 bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
                <p className="text-xs text-gray-500">
                  Add members now. You can still manage them later from the directory members view.
                </p>
              </div>
              {loadingUsers && <span className="text-xs text-gray-500">Loading users...</span>}
            </div>

            <div className="mt-3 space-y-3">
              {availableUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No additional org users available.</p>
              ) : (
                availableUsers.map((user) => {
                  const uid = user?.uid || user?.user_id || user?.id;
                  const selected = members.find((member) => member.uid === uid);
                  return (
                    <div
                      key={uid}
                      className="flex flex-col gap-3 rounded-lg border border-orange-100 bg-orange-50/60 p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selected)}
                          onChange={(e) => handleMemberToggle(uid, e.target.checked)}
                          className="h-4 w-4 rounded text-orange-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user?.display_name || user?.name || user?.email || uid}
                          </p>
                          <p className="text-xs text-gray-500">{user?.email || uid}</p>
                        </div>
                      </label>

                      <select
                        value={selected?.role || "contributor"}
                        onChange={(e) => handleMemberRoleChange(uid, e.target.value)}
                        disabled={!selected}
                        className={`${inputClassName} w-full md:w-44`}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="contributor">Contributor</option>
                        <option value="editor">Editor</option>
                        <option value="owner">Owner</option>
                      </select>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving..." : isEditing ? "Update Directory" : "Create Directory"}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg bg-orange-200 px-4 py-2 font-semibold text-gray-900 transition-colors hover:bg-orange-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required = false, children }) {
  return (
    <div>
      <div className="mb-2 block text-sm font-medium text-gray-900">
        {label} {required && <span className="text-orange-600">*</span>}
      </div>
      {children}
    </div>
  );
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const inputClassName =
  "w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500";
