// app/(your-path)/UsersPage.jsx
"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Calendar, CheckCircle, Clock, Copy, Mail, Shield,
  Users, Trash2, Ban, Undo2, ChevronDown, AlertCircle, UserPlus,
  Users2
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { Icon } from "@iconify/react";
import Link from "next/link";
import CreateUserModal from "@/components/team/CreateUser";

// ==================== Constants ====================
const USERS_PER_PAGE = 6;
const AVATAR_COLORS = [
  "bg-[#9A3EEE]",
  "bg-[#F06310]",
  "bg-[#2C6DEF]",
  "bg-gradient-to-br from-orange-500 to-red-500"
];

const ROLE_STYLES = {
  owner:           "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  admin:           "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  billing_admin:   "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  security_admin:  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  manager:         "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  member:          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  auditor:         "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  integration:     "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

const ROLES = [
  { value: "member",          label: "Member" },
  { value: "manager",         label: "Manager" },
  { value: "admin",           label: "Admin" },
  { value: "billing_admin",   label: "Billing Admin" },
  { value: "security_admin",  label: "Security Admin" },
  { value: "auditor",         label: "Auditor (Read-only)" },
  { value: "integration",     label: "Integration (Bot)" },
];

// ==================== Utility Functions ====================
const normalizeDate = (dateInput) => {
  if (!dateInput) return null;

  if (typeof dateInput?.toDate === "function") {
    return dateInput.toDate();
  }

  if (dateInput?.seconds) {
    return new Date(dateInput.seconds * 1000);
  }

  return new Date(dateInput);
};

const formatDate = (dateInput) => {
  const date = normalizeDate(dateInput);
  if (!date) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const getAvatarColor = (index) => AVATAR_COLORS[index % AVATAR_COLORS.length];

const getRoleBadgeStyle = (role) => {
  return ROLE_STYLES[(role || "member").toLowerCase()] || ROLE_STYLES.member;
};

const capitalizeRole = (role) => {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

// ==================== Toast Notification ====================
const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-green-500" : "bg-red-500";

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-slide-in`}>
      {type === "error" && <AlertCircle size={20} />}
      {type === "success" && <CheckCircle size={20} />}
      <span>{message}</span>
    </div>
  );
};

// ==================== Status Badge Component ====================
const StatusTag = ({ status }) => {
  const isActive = (status || "").toLowerCase() === "active";

  return isActive ? (
    <span className="flex items-center gap-1 bg-[#DCFCE7] text-[#1B803D] dark:bg-green-900 dark:text-green-200 rounded-2xl px-2 py-1 text-[10px] font-medium">
      <CheckCircle size={12} /> Active
    </span>
  ) : (
    <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-2xl px-2 py-1 text-[10px] font-medium">
      <Clock size={12} /> {capitalizeRole(status) || "Pending"}
    </span>
  );
};

// ==================== Invite Section Component ====================
const InviteSection = ({ inviteLink, isOwner, onCopy, copied, onOpenCreateModal }) => {
  return (
    <div className="rounded-2xl py-6 px-10 mb-8 bg-[#FCF0E5] dark:bg-[#4F3E32]">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-[#ED7A13] rounded-lg text-white">
          <Icon icon="mdi:people-add" width="16" height="16" />
        </div>
        <p className="text-md font-semibold dark:text-[#CBC9DE]">Invite Team Member</p>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8A97]" />
          <input
            value={inviteLink}
            readOnly
            className="w-full bg-white text-[#8C8A97] dark:bg-black dark:text-white pl-10 pr-4 py-3 rounded-md text-sm outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Invite link"
          />
        </div>
        <button
          onClick={onCopy}
          disabled={!isOwner}
          className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 text-white transition-all ${
            copied ? "bg-green-500" : "bg-[#ED7A13] hover:bg-[#D66A0F]"
          } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500`}
          aria-label={copied ? "Link copied" : "Copy invite link"}
        >
          <Copy size={16} />
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
      
      {/* Create User Button */}
      {isOwner && (
        <button
          onClick={onOpenCreateModal}
          className="w-full bg-white dark:bg-[#2A2A2A] text-[#ED7A13] border-2 border-[#ED7A13] px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#ED7A13] hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          <UserPlus size={18} />
          Create New User Account
        </button>
      )}
      
      {!isOwner && (
        <p className="mt-2 text-xs text-[#8C8A97] flex items-center gap-1">
          <Shield size={12} /> Only the organisation owner can invite or edit members.
        </p>
      )}
    </div>
  );
};

// ==================== User Card Component ====================
const UserCard = ({ member, index, isOwner, ownerUID, busyUid, onChangeRole, onToggleStatus, onRemove }) => {
  const canEdit = isOwner && member.uid !== ownerUID;
  const isBusy = busyUid === member.uid;
  const isActive = (member.status || "").toLowerCase() === "active";
  const color = getAvatarColor(index);

  return (
    <div className="group rounded-2xl px-4 py-3 transition-all hover:shadow-lg hover:bg-gray-50 dark:hover:bg-[#2A2A2A]">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* User Info */}
        <div className="flex items-start gap-4 flex-1">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${color} flex-shrink-0`}>
            {(member.email?.[0] || "?").toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold truncate dark:text-[#96949C]">
                {member.email?.split("@")[0] || member.uid}
              </p>
              <StatusTag status={member.status} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[#8C8A97] dark:text-[#5B596A] text-xs">
              <span className="truncate">{member.email}</span>
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Joined {formatDate(member.joinedAt || member.joined_at)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[#ED7A13]" />
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeStyle(member.role)}`}>
                {capitalizeRole(member.role)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Dropdown */}
          <div className="relative">
            <select
              className={`text-sm border rounded-lg px-3 py-2 pr-8 bg-white dark:bg-[#2A2A2A] dark:text-white dark:border-gray-600 appearance-none ${
                !canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-orange-500"
              } focus:outline-none focus:ring-2 focus:ring-orange-500`}
              value={member.role || "member"}
              onChange={(e) => onChangeRole(member, e.target.value)}
              disabled={!canEdit || isBusy}
              aria-label="Change user role"
            >
              {ROLES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>

          {/* Suspend/Activate Button */}
          <button
            onClick={() => onToggleStatus(member)}
            disabled={!canEdit || isBusy}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
              isActive
                ? "border-yellow-300 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-300 hover:bg-yellow-100"
                : "border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:border-green-600 dark:text-green-300 hover:bg-green-100"
            } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isActive ? "focus:ring-yellow-500" : "focus:ring-green-500"
            }`}
            title={isActive ? "Suspend user" : "Activate user"}
            aria-label={isActive ? "Suspend user" : "Activate user"}
          >
            {isBusy ? (
              <span className="inline-flex items-center gap-1">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </span>
            ) : isActive ? (
              <span className="inline-flex items-center gap-1">
                <Ban className="w-4 h-4" /> Suspend
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Undo2 className="w-4 h-4" /> Activate
              </span>
            )}
          </button>

          {/* Remove Button */}
          <button
            onClick={() => onRemove(member)}
            disabled={!canEdit || isBusy}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-300 text-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-600 dark:text-red-300 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            title="Remove from organisation"
            aria-label="Remove user from organisation"
          >
            <span className="inline-flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Remove
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Pagination Component ====================
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center mt-6 gap-2">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#333] dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-[#444] transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label="Previous page"
      >
        Previous
      </button>
      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i}
          onClick={() => onPageChange(i + 1)}
          className={`px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 ${
            currentPage === i + 1
              ? "bg-orange-500 text-white"
              : "bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#333]"
          }`}
          aria-label={`Go to page ${i + 1}`}
          aria-current={currentPage === i + 1 ? "page" : undefined}
        >
          {i + 1}
        </button>
      ))}
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#333] dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-[#444] transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
};

// ==================== Loading Spinner Component ====================
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
  </div>
);

// ==================== Empty State Component ====================
const EmptyState = () => (
  <div className="text-center py-12 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1A1A1E]">
    <Users size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
    <p className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">No team members yet</p>
    <p className="text-gray-500 dark:text-gray-400">Invite your first team member to get started</p>
  </div>
);

// ==================== Main Component ====================
export default function UsersPage() {
  const pathname = usePathname();
  const orgId = pathname.split("/")[3];
  const { organisation, update: updateOrg } = useOrganisation();
  const { user: currentUser, updateUser, deleteUser } = useUser();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [busyUid, setBusyUid] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const inviteLink = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/postgres-register?orgId=${orgId}`;

  // Derive permissions
  const isOwner = useMemo(
    () => !!organisation?.owner_uid && currentUser?.uid === String(organisation.owner_uid),
    [organisation?.owner_uid, currentUser?.uid]
  );

  const ownerUID = organisation?.owner_uid;

  const totalPages = Math.ceil(users.length / USERS_PER_PAGE);
  const paginatedUsers = useMemo(
    () => users.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE),
    [users, currentPage]
  );

  // Load users from organisation.team_members
  useEffect(() => {
    if (organisation?.team_members) {
      setUsers(organisation.team_members);
      setLoading(false);
    }
  }, [organisation]);

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    showToast("Invite link copied to clipboard!");
    setTimeout(() => setCopied(false), 1300);
  }, [inviteLink, showToast]);

  const persistTeamMembers = async (nextMembers) => {
    const orgIdentifier = String(organisation.org_id || organisation.orgId || orgId);
    await updateOrg(orgIdentifier, {
      team_members: nextMembers,
      updated_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    });
  };

  // When a new user is created via CreateUserModal
  const handleUserCreatedIntoOrg = async (createdUser) => {
    const mapped = {
      uid: createdUser.uid,
      email: createdUser.email,
      role: createdUser.role,
      status: createdUser.status || "active",
      joinedAt: createdUser.joined_at || new Date().toISOString(),
      orgIds: createdUser.org_ids || [],
      meta: createdUser.meta_data || {},
    };

    const next = [...users, mapped];
    setUsers(next);
    await persistTeamMembers(next);
    showToast("User created and added to organisation");
  };

  const handleChangeRole = async (member, nextRole) => {
    if (!isOwner || member.uid === ownerUID) return;

    setBusyUid(member.uid);
    try {
      await updateUser(member.uid, { role: nextRole });

      const updatedUsers = users.map((m) =>
        m.uid === member.uid ? { ...m, role: nextRole } : m
      );
      setUsers(updatedUsers);

      await persistTeamMembers(updatedUsers);
      showToast(`Role updated to ${capitalizeRole(nextRole)}`);
    } catch (error) {
      console.error("Error changing role:", error);
      showToast("Failed to update role. Please try again.", "error");
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleStatus = async (member) => {
    if (!isOwner || member.uid === ownerUID) return;

    const isActive = (member.status || "").toLowerCase() === "active";
    setBusyUid(member.uid);

    try {
      const newStatus = isActive ? "suspended" : "active";
      await updateUser(member.uid, { status: newStatus });

      const updatedUsers = users.map((m) =>
        m.uid === member.uid ? { ...m, status: newStatus } : m
      );
      setUsers(updatedUsers);

      await persistTeamMembers(updatedUsers);
      showToast(isActive ? "User suspended successfully" : "User activated successfully");
    } catch (error) {
      console.error("Error toggling status:", error);
      showToast("Failed to update user status. Please try again.", "error");
    } finally {
      setBusyUid(null);
    }
  };

  const handleRemove = async (member) => {
    if (!isOwner || member.uid === ownerUID) return;

    if (!confirm(`Remove ${member.email || member.uid} from the organisation?`)) {
      return;
    }

    setBusyUid(member.uid);
    try {
      const updatedUsers = users.filter((m) => m.uid !== member.uid);
      setUsers(updatedUsers);

      await persistTeamMembers(updatedUsers);
      showToast("User removed from organisation");
    } catch (error) {
      console.error("Error removing user:", error);
      showToast("Failed to remove user. Please try again.", "error");
      setUsers(users);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto">
        {/* Toast Notification */}
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
 <Link
      href="./team/groups"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      <Users2 size={16} />
      <span>Groups</span>
    </Link>

        {/* Create User Modal */}
        <CreateUserModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          defaultOrgId={orgId}
          currentUser={currentUser}
          onUserCreated={handleUserCreatedIntoOrg}
        />

        {/* Header */}
        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold dark:text-[#CBC9DE]">Team Members</h1>
          <p className="text-xs text-[#5B596A]">Manage your team and invite new members</p>
        </div>

        {/* Invite Section with Create User Button */}
        <InviteSection
          inviteLink={inviteLink}
          isOwner={isOwner}
          onCopy={copyToClipboard}
          copied={copied}
          onOpenCreateModal={() => setIsModalOpen(true)}
        />

        {/* Users List */}
        <div className="bg-white dark:bg-[#1A1A1E] rounded-lg px-4 py-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-[#ED7A13] rounded-lg text-white">
              <Icon icon="pepicons-pencil:people" width="20" height="20" />
            </div>
            <h2 className="text-xl font-semibold text-black dark:text-[#CBC9DE]">Team Members</h2>
            <span className="bg-[#DEDEDE] dark:bg-[#2A2A2A] rounded-2xl px-2 py-1 font-medium text-[10px]">
              {users.length} {users.length === 1 ? "member" : "members"}
            </span>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : users.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2">
              {paginatedUsers.map((member, index) => (
                <UserCard
                  key={member.uid}
                  member={member}
                  index={(currentPage - 1) * USERS_PER_PAGE + index}
                  isOwner={isOwner}
                  ownerUID={ownerUID}
                  busyUid={busyUid}
                  onChangeRole={handleChangeRole}
                  onToggleStatus={handleToggleStatus}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}