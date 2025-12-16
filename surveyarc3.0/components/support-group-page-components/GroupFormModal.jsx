"use client"
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useEffect, useState } from "react";

export default function GroupFormModal  ({ isOpen, onClose, onSave, group, orgId }) {
  const { getActiveUsersByOrg } = useUser();
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    description: ""
  });

  // Load available users when modal opens
  useEffect(() => {
    const loadUsers = async () => {
      if (isOpen && orgId) {
        try {
          setUsersLoading(true);
          const users = await getActiveUsersByOrg({ orgId });
          setAvailableUsers(users || []);
        } catch (error) {
          console.error("Error loading users:", error);
          setAvailableUsers([]);
        } finally {
          setUsersLoading(false);
        }
      }
    };

    loadUsers();
  }, [isOpen, orgId, getActiveUsersByOrg]);

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name || "",
        email: group.email || "",
        description: group.description || ""
      });
    } else {
      setFormData({ name: "", email: "", description: "" });
    }
  }, [group, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        org_id: orgId,
        ...(group ? { group_id: group.groupId } : {})
      };
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error("Error saving group:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {group ? "Edit Support Group" : "Create Support Group"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Group Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Contact Email (Optional)
            </label>
            
            <div className="space-y-2">
              {usersLoading ? (
                <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm text-gray-600">Loading users...</span>
                </div>
              ) : (
                <select
                  value={availableUsers.find(u => u.email === formData.email)?.uid || ""}
                  onChange={(e) => {
                    const selectedUser = availableUsers.find(u => u.uid === e.target.value);
                    setFormData(prev => ({ 
                      ...prev, 
                      email: selectedUser ? selectedUser.email : ""
                    }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select from organization users...</option>
                  {availableUsers.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.display_name ? `${user.display_name} (${user.email})` : user.email}
                    </option>
                  ))}
                </select>
              )}
              
              <div className="flex items-center">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-3 text-xs text-gray-500 bg-white">OR</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>
              
              <input
                type="email"
                placeholder="Enter custom email address..."
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <p className="text-xs text-gray-500 mt-1">
              Choose a user from your organization or enter a custom email
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {group ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};