"use client"
import { useBusinessCalendars } from "@/providers/BusinessCalendarsProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { Calendar, Clock } from "lucide-react";
import { useEffect, useState } from "react";

const PROFICIENCY_LEVELS = {
  l1: "Level 1",
  l2: "Level 2", 
  l3: "Level 3",
  specialist: "Specialist"
};

const MEMBER_ROLES = {
  agent: "Agent",
  lead: "Team Lead",
  viewer: "Viewer"
};

const ROUTING_TARGETS = {
  group: "Group",
  team: "Team"
};

export default function TeamFormModal ({ isOpen, onClose, onSave, team, groupId, orgId }) {
  const { getActiveUsersByOrg } = useUser();
  const { calendars, list: loadCalendars, loading: calendarsLoading } = useBusinessCalendars();
  
  const [availableUsers, setAvailableUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    email: "",
    target_proficiency: "l1",
    routing_weight: 1,
    default_sla_id: "",
    calendar_id: ""
  });

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
    const loadAvailableCalendars = async () => {
      if (isOpen && orgId) {
        try {
          await loadCalendars({ orgId, active: true });
        } catch (error) {
          console.error("Error loading calendars:", error);
        }
      }
    };

    loadAvailableCalendars();
  }, [isOpen, orgId, loadCalendars]);

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || "",
        description: team.description || "",
        email: team.email || "",
        target_proficiency: team.targetProficiency || "l1",
        routing_weight: team.routingWeight || 1,
        default_sla_id: team.defaultSlaId || "",
        calendar_id: team.calendarId || ""
      });
    } else {
      setFormData({
        name: "",
        description: "",
        email: "",
        target_proficiency: "l1",
        routing_weight: 1,
        default_sla_id: "",
        calendar_id: ""
      });
    }
  }, [team, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        org_id: orgId,
        group_id: groupId,
        targetProficiency: formData.target_proficiency,
        routingWeight: formData.routing_weight,
        defaultSlaId: formData.default_sla_id,
        calendarId: formData.calendar_id || null,
        ...(team ? { team_id: team.teamId } : {})
      };
      console.log(payload)
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error("Error saving team:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            {team ? "Edit Team" : "Create Team"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Team Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Target Proficiency</label>
            <select
              value={formData.target_proficiency}
              onChange={(e) => setFormData(prev => ({ ...prev, target_proficiency: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(PROFICIENCY_LEVELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Routing Weight</label>
            <input
              type="number"
              min="1"
              value={formData.routing_weight}
              onChange={(e) => setFormData(prev => ({ ...prev, routing_weight: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Calendar Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Business Calendar (Optional)
              </span>
            </label>
            
            {calendarsLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-gray-600">Loading calendars...</span>
              </div>
            ) : (
              <select
                value={formData.calendar_id}
                onChange={(e) => setFormData(prev => ({ ...prev, calendar_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No calendar assigned</option>
                {calendars
                  .filter(calendar => calendar.active)
                  .map((calendar) => (
                    <option key={calendar.calendar_id} value={calendar.calendar_id}>
                      {calendar.name} ({calendar.timezone})
                    </option>
                  ))}
              </select>
            )}
            
            <p className="text-xs text-gray-500 mt-1">
              Assign a business calendar to define working hours and holidays for this team
            </p>
            
            {/* Calendar Preview */}
            {formData.calendar_id && (
              <div className="mt-2 p-2 bg-blue-50 rounded border">
                {(() => {
                  const selectedCalendar = calendars.find(c => c.calendar_id === formData.calendar_id);
                  if (selectedCalendar) {
                    return (
                      <div className="text-xs text-blue-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium">{selectedCalendar.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-blue-600">
                          <span>{selectedCalendar.hours?.length || 0} time slots</span>
                          <span>{selectedCalendar.holidays?.length || 0} holidays</span>
                          <span>{selectedCalendar.timezone}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
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
            <label className="block text-sm font-medium mb-2">Description</label>
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
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {team ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};