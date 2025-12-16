// app/(your-path)/UsersPage.jsx
"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Calendar, CheckCircle, Clock, Copy, Mail, Shield,
  Users, Trash2, Ban, Undo2, ChevronDown, AlertCircle, UserPlus,
  Users2, Lock
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { Icon } from "@iconify/react";
import Link from "next/link";
import CreateUserModal from "@/components/team/CreateUser";
import UserRoleManager from "@/components/rbac/UserRoleManager";
import { RBACProvider, useRBAC } from "@/providers/RBACProvider";
import { ProtectedAction } from "@/components/rbac/ProtectedAction";
import PermissionManager from "@/components/rbac/PermissionManager";

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
  if (typeof dateInput?.toDate === "function") return dateInput.toDate();
  if (dateInput?.seconds) return new Date(dateInput.seconds * 1000);
  return new Date(dateInput);
};

const formatDate = (dateInput) => {
  const date = normalizeDate(dateInput);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
};

const getAvatarColor = (index) => AVATAR_COLORS[index % AVATAR_COLORS.length];
const getRoleBadgeStyle = (role) => ROLE_STYLES[(role || "member").toLowerCase()] || ROLE_STYLES.member;
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

// ==================== Status Badge ====================
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

// ==================== Invite Section ====================
const InviteSection = ({ inviteLink, isOwner, onCopy, copied, onOpenCreateModal, orgId }) => {
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
        
        {/* Protected Copy Button */}
        <ProtectedAction permission="team.invite" orgId={orgId} scope="org"         resourceId={orgId}
>
          <button
            onClick={onCopy}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 text-white transition-all ${
              copied ? "bg-green-500" : "bg-[#ED7A13] hover:bg-[#D66A0F]"
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500`}
            aria-label={copied ? "Link copied" : "Copy invite link"}
          >
            <Copy size={16} />
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </ProtectedAction>
      </div>
      
      {/* Protected Create User Button */}
      <ProtectedAction 
        permission="rbac.assign_role" 
        orgId={orgId} 
        resourceId={orgId}
        scope="org"
        fallback={
          <div className="w-full bg-gray-100 dark:bg-gray-800 text-gray-400 px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-not-allowed">
            <Lock size={18} />
            Insufficient Permissions
          </div>
        }
      >
        <button
          onClick={onOpenCreateModal}
          className="w-full bg-white dark:bg-[#2A2A2A] text-[#ED7A13] border-2 border-[#ED7A13] px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#ED7A13] hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          <UserPlus size={18} />
          Create New User Account
        </button>
      </ProtectedAction>
      
      {!isOwner && (
        <p className="mt-2 text-xs text-[#8C8A97] flex items-center gap-1">
          <Shield size={12} /> Only users with proper permissions can manage members.
        </p>
      )}
    </div>
  );
};

// ==================== User Card ====================
const UserCard = ({ member, index, isOwner, ownerUID, busyUid, onChangeRole, onToggleStatus, onRemove, onOpenPermissions, orgId }) => {
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
            
            {/* Protected Permissions Button */}
            <ProtectedAction permission="rbac.view_assignments" orgId={orgId} scope="org"         resourceId={orgId}
>
              <button
                onClick={() => onOpenPermissions(member)}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 transition-all"
                title="Manage roles & permissions"
              >
                <Shield className="w-4 h-4 inline mr-1" />
                Permissions
              </button>
            </ProtectedAction>

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
          {/* Protected Role Dropdown */}
          <ProtectedAction 
            permission="rbac.assign_role" 
            orgId={orgId}
                    resourceId={orgId}

            scope="org"
            fallback={
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Lock size={12} />
                Locked
              </div>
            }
          >
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
          </ProtectedAction>

          {/* Protected Suspend/Activate Button */}
          <ProtectedAction permission="team.manage_status" orgId={orgId} scope="org" resourceId={orgId}>
            <button
              onClick={() => onToggleStatus(member)}
              disabled={!canEdit || isBusy}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                isActive
                  ? "border-yellow-300 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-300 hover:bg-yellow-100"
                  : "border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:border-green-600 dark:text-green-300 hover:bg-green-100"
              } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2`}
              title={isActive ? "Suspend user" : "Activate user"}
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
          </ProtectedAction>

          {/* Protected Remove Button */}
          <ProtectedAction permission="team.remove_member" orgId={orgId} scope="org" resourceId={orgId}>
            <button
              onClick={() => onRemove(member)}
              disabled={!canEdit || isBusy}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-300 text-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-600 dark:text-red-300 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              title="Remove from organisation"
            >
              <span className="inline-flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Remove
              </span>
            </button>
          </ProtectedAction>
        </div>
      </div>
    </div>
  );
};

// ==================== Pagination ====================
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center mt-6 gap-2">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#333] dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-[#444] transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
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
        >
          {i + 1}
        </button>
      ))}
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#333] dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-[#444] transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        Next
      </button>
    </div>
  );
};

// ==================== Loading & Empty States ====================
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
  </div>
);

const EmptyState = () => (
  <div className="text-center py-12 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1A1A1E]">
    <Users size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-600" />
    <p className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">No team members yet</p>
    <p className="text-gray-500 dark:text-gray-400">Invite your first team member to get started</p>
  </div>
);

// ==================== Main Component (Inner) ====================
function UsersPageInner() {
  const pathname = usePathname();
  const orgId = pathname.split("/")[3];
  const { organisation, update: updateOrg } = useOrganisation();
  const { user: currentUser, updateUser, deleteUser, uid } = useUser();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [busyUid, setBusyUid] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [permissionUser, setPermissionUser] = useState(null);

  const inviteLink = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/postgres-register?orgId=${orgId}`;

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

  const openPermissions = useCallback((user) => setPermissionUser(user), []);
  const closePermissions = useCallback(() => setPermissionUser(null), []);

  useEffect(() => {
    if (organisation?.team_members) {
      setUsers(organisation.team_members);
      setLoading(false);
    }
  }, [organisation]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

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
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

        <Link
          href="./team/groups"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 mb-4"
        >
          <Users2 size={16} />
          <span>Groups</span>
        </Link>

        <CreateUserModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          defaultOrgId={orgId}
          currentUser={currentUser}
          onUserCreated={handleUserCreatedIntoOrg}
        />

        {permissionUser && (
          <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
            <div className="w-full max-w-xl bg-white dark:bg-[#1A1A1E] h-full shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                <h3 className="font-semibold text-lg dark:text-white">
                  Permissions — {permissionUser.email}
                </h3>
                <button
                  onClick={closePermissions}
                  className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                <UserRoleManager userId={permissionUser.uid} orgId={orgId} />
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold dark:text-[#CBC9DE]">Team Members</h1>
          <p className="text-xs text-[#5B596A]">Manage your team and invite new members</p>
        </div>

        <InviteSection
          inviteLink={inviteLink}
          isOwner={isOwner}
          onCopy={copyToClipboard}
          copied={copied}
          onOpenCreateModal={() => setIsModalOpen(true)}
          orgId={orgId}
        />
      <PermissionManager orgId={orgId} />

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
                  onOpenPermissions={openPermissions}
                  orgId={orgId}
                />
              ))}
            </div>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}

// ==================== Main Export with RBAC Provider ====================
export default function UsersPage() {
  return (
    <RBACProvider>
      <UsersPageInner />
    </RBACProvider>
  );
}