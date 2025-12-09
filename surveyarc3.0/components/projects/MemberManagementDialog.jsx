import React, { useState } from "react";
import { X, UserPlus, Trash2, Loader } from "lucide-react";
import { descendingComparator, getComparator, getId, getRole   } from "@/utils/projectUtils";

export function MemberManagementDialog({
  open,
  onClose,
  project,
  loading,
  candidates,
  byUid,
  onAddMember,
  onRemoveMember,
  busy,
}) {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [newMemberRole, setNewMemberRole] = useState("contributor");

  if (!open) return null;

  const handleAdd = async () => {
    if (!selectedCandidate) return;
    const uid = getId(selectedCandidate);
    const email = selectedCandidate.email || "";
    await onAddMember(uid, email, newMemberRole);
    setSelectedCandidate(null);
    setNewMemberRole("contributor");
  };

  const memberLabel = (m) => {
    const uid = getId(m);
    const prof = byUid(uid);
    return prof?.display_name || prof?.email || m?.email || uid || "—";
  };

  const memberEmail = (m) => {
    const uid = getId(m);
    const prof = byUid(uid);
    const email = prof?.email || m?.email || "";
    return email && email !== memberLabel(m) ? email : "";
  };

  const memberAvatarText = (m) => {
    const nameLike = memberLabel(m);
    return (nameLike || "?").charAt(0).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
            {project && (
              <p className="text-sm text-gray-600 mt-1">{project.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {!loading && (
            <>
              {/* Current Members */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Current Members ({(project?.members || []).length})
                </h3>
                
                {(project?.members || []).length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-4">
                    No team members yet. Add members below.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(project?.members || []).map((m) => {
                      const uid = getId(m);
                      const name = memberLabel(m);
                      const email = memberEmail(m);
                      const avatarText = memberAvatarText(m);
                      const role = getRole(m);

                      return (
                        <div
                          key={uid}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                              {avatarText}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{name}</div>
                              {email && (
                                <div className="text-xs text-gray-500">{email}</div>
                              )}
                              <div className="text-xs text-gray-400">{uid}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {role && (
                              <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                                {role}
                              </span>
                            )}
                            <button
                              onClick={() => onRemoveMember(uid)}
                              disabled={busy}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add New Member */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Add New Member
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Member
                    </label>
                    <select
                      value={selectedCandidate ? getId(selectedCandidate) : ""}
                      onChange={(e) => {
                        const member = candidates.find(
                          (c) => getId(c) === e.target.value
                        );
                        setSelectedCandidate(member || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Choose a member...</option>
                      {candidates.map((c) => {
                        const uid = getId(c);
                        const email = c.email || uid;
                        const role = getRole(c);
                        return (
                          <option key={uid} value={uid}>
                            {email} {role && `(${role})`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="contributor">Contributor</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedCandidate || busy}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Add Member
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}