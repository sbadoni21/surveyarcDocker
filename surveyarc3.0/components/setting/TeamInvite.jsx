"use client";
import React, { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  Mail,
  Send,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useOrganisation } from "@/providers/organisationPProvider";
import { Icon } from "@iconify/react";
import { CiMail } from "react-icons/ci";
import { MdOutlineMail } from "react-icons/md";
export default function TeamInvite() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  const orgId = usePathname().split("/")[3];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Viewer");

  const handleSendInvite = async () => {
    if (!email) return alert("Please enter an email address.");

    try {
      const res = await fetch("/api/send-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, role, inviteLink }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Invite sent successfully!");
        setEmail("");
        setRole("Viewer");
      } else {
        alert("Failed to send invite.");
      }
    } catch (error) {
      console.error("Error sending invite:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const USERS_PER_PAGE = 3;
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedUsers = users.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  const totalPages = Math.ceil(users.length / USERS_PER_PAGE);

  const inviteLink = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/register?orgId=${orgId}`;
  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const { organisation } = useOrganisation();
  useEffect(() => {
    if (organisation?.teamMembers) {
      setUsers(organisation.teamMembers);
      setLoading(false);
    }
  }, [organisation]);

  const getColor = (index) => {
    const colors = [
      "bg-[#9A3EEE]",
      "bg-[#F06310]",
      "bg-[#2C6DEF]",
      "bg-gradient-to-br from-orange-500 to-red-500",
    ];
    return colors[index % colors.length];
  };
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case "admin":
        return "bg-orange-100 text-orange-800 ";
      case "moderator":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-yellow-100 text-yellow-800 ";
    }
  };
  const getStatusIcon = (status) => {
    return status === "active" ? (
      <CheckCircle size={14} className="text-green-500" />
    ) : (
      <Clock size={14} className="text-yellow-500" />
    );
  };
  return (
    <div className="min-h-screen">
      <div className=" mx-auto">
        <div className="rounded-2xl py-6 mb-8 bg-white dark:bg-[#1A1A1E] dark:border-[#96949C3B] px-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-[#ED7A13] rounded-lg text-white">
              <Mail size={16} />
            </div>
            <h2 className="text-2xl dark:text-[#CBC9DE] font-semibold text-slate-800">
              Invite team members
            </h2>
          </div>
          <div className="mb-8">
            <p className="mb-4 text-sm font-medium text-slate-700 dark:text-[#96949C]">
              Single Invite
            </p>

            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-600 dark:text-[#5B596A]">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="Enter email"
                  className="w-full border border-slate-300 dark:border-[#96949C3B] dark:bg-[#1A1A1E] px-4 py-3 rounded-md text-sm focus:outline-none "
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-slate-600 dark:text-[#5B596A]">
                  Role
                </label>
                <select
                  className="w-full border border-slate-300 dark:border-[#96949C3B] dark:bg-[#1A1A1E] px-3 py-3 rounded-md text-sm focus:outline-none "
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Viewer">Viewer</option>
                  <option value="Editor">Editor</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div className="flex items-end pt-6 md:pt-0">
                <button
                  onClick={handleSendInvite}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-3 px-5 rounded-md flex items-center gap-2"
                >
                  <Send size={16} />
                  Send Invite
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm dark:text-[#5B596A]">Invite Link</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8C8A97]"
              />
              <input
                value={inviteLink}
                readOnly
                className="w-full border dark:border-[#96949C3B] dark:text-[#96949C] dark:bg-[#1A1A1E] border-[#8C8A97] bg-white text-[#8C8A97]  pl-10 pr-4 py-3 rounded-md text-sm transition-all duration-200 outline-none"
              />
            </div>
            <button
              onClick={copyToClipboard}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 transform hover:scale-105 active:scale-95  ${
                copied ? "bg-green-500 text-white " : "text-white "
              }`}
              style={{
                backgroundColor: copied ? "#10B981" : "var(--primary)",
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.target.style.backgroundColor = "var(--primary-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.target.style.backgroundColor = "var(--primary)";
                }
              }}
            >
              <Copy size={16} />
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
        <div className="h-fit bg-white dark:bg-[#1A1A1E] rounded-3xl border border-[#8C8A973B] px-4 py-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-[#ED7A13] rounded-lg text-white">
              <Icon icon="pepicons-pencil:people" width="20" height="20" />
            </div>
            <p className="text-xl font-semibold text-black dark:text-[#CBC9DE]">
              Team Members
            </p>
            <p className="bg-[#DEDEDE] rounded-2xl px-2 py-1 font-medium text-[10px]">
              {organisation?.teamMembers.length} members
            </p>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500"></div>
            </div>
          ) : users.length === 0 ? (
            <div
              className="text-center py-12 rounded-2xl border-2 border-dashed"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface)",
              }}
            >
              <Users
                size={48}
                className="mx-auto mb-4"
                style={{ color: "var(--text-secondary)" }}
              />
              <p
                className="text-lg font-medium mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                No team members yet
              </p>
              <p style={{ color: "var(--text-secondary)" }}>
                Invite your first team member to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedUsers.map((user, index) => (
                <div
                  key={user.uid}
                  className="group rounded-2xl px-4 py-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg  ${getColor(
                        (currentPage - 1) * USERS_PER_PAGE + index
                      )}`}
                    >
                      {user.email?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 ">
                        <p className="font-semibold truncate dark:text-[#96949C]">
                          {user.email.split("@")[0]}
                        </p>
                        <p
                          className={`flex items-center capitalize rounded-2xl px-2 py-1 text-[10px] ${
                            user.status == "active"
                              ? "bg-[#DCFCE7] dark:bg-[#2B3336] text-[#1B803D]"
                              : "bg-yellow-500 dark:bg-[#4F3E32] text-yellow-500"
                          }`}
                        >
                          {getStatusIcon(user.status)}
                          <span className="ml-1">{user.status}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-[#8C8A97] dark:text-[#8C8A97]">
                        <div className="flex items-center gap-1.5 text-xs">
                          <MdOutlineMail /> <p>{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar size={12} />
                          <span>
                            Joined{" "}
                            {user.joinedAt
                              ? typeof user.joinedAt.toDate === "function"
                                ? user.joinedAt
                                    .toDate()
                                    .toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                : new Date(
                                    user.joinedAt.seconds * 1000
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 dark:text-[#5B596A] rounded-full text-xs font-medium `}
                        >
                          {user.role.charAt(0).toUpperCase() +
                            user.role.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center mt-2 gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-[#333] dark:text-white disabled:opacity-50"
            >
              Previous
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 rounded ${
                  currentPage === i + 1
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-200"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-[#333] dark:text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
