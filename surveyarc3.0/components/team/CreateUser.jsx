// components/users/CreateUserModal.jsx
"use client";

import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "member",         label: "Member" },
  { value: "manager",        label: "Manager" },
  { value: "admin",          label: "Admin" },
  { value: "billing_admin",  label: "Billing Admin" },
  { value: "security_admin", label: "Security Admin" },
  { value: "auditor",        label: "Auditor (Read-only)" },
  { value: "integration",    label: "Integration (Bot)" },
  { value: "agent",          label: "Agent" },
];

export default function CreateUserModal({ isOpen, onClose, defaultOrgId, currentUser, onUserCreated }) {
  const { adminCreateUser } = useUser();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "member",
    orgId: defaultOrgId || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Keep orgId in sync if parent orgId changes
  useEffect(() => {
    if (defaultOrgId) {
      setFormData((prev) => ({ ...prev, orgId: defaultOrgId }));
    }
  }, [defaultOrgId]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.orgId) {
        throw new Error("Organisation ID is required");
      }

      const payload = {
        email: formData.email,
        password: formData.password,
        current_user_id: currentUser.uid,
        displayName: formData.displayName,
        role: formData.role,
        orgId: String(formData.orgId),
        status: "active",
        metaData: {},
      };

      console.log("[CreateUserModal] Sending payload:", payload);

      const result = await adminCreateUser(payload);

      console.log("[CreateUserModal] Created user result:", result);
      setSuccess(`User created successfully! UID: ${result.uid || "N/A"}`);

      if (onUserCreated) {
        onUserCreated(result);
      }

      // Reset form and close modal after short delay
      setTimeout(() => {
        setFormData({
          email: "",
          password: "",
          displayName: "",
          role: "member",
          orgId: defaultOrgId || "",
        });
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Create user error:", err);
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-[#1A1A1E] rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors"
          aria-label="Close modal"
        >
          <X size={20} className="text-gray-500 dark:text-gray-400" />
        </button>

        {/* Modal Content */}
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-[#CBC9DE]">
            Create New User
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white"
                placeholder="user@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white"
                placeholder="Min 8 characters"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Minimum 8 characters required
              </p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white"
                placeholder="John Doe"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Org ID */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Organization ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="orgId"
                value={formData.orgId}
                onChange={handleChange}
                required
                disabled={!!defaultOrgId}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 dark:disabled:bg-gray-800 bg-white dark:bg-[#2A2A2A] text-gray-900 dark:text-white"
                placeholder="org_123456"
              />
              {defaultOrgId && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Organization ID is preset
                </p>
              )}
            </div>

            {/* Errors / Success */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
                <strong>Error:</strong> {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800">
                <strong>Success:</strong> {success}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-orange-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}