"use client"
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { Calendar1Icon, Clock, Timer,  X } from "lucide-react";
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

export default function CalendarDetailsModal ({ isOpen, onClose, team, calendarData })  {
  if (!isOpen || !calendarData) return null;

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const WEEKDAY_NAMES = {
    0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday",
    4: "Friday", 5: "Saturday", 6: "Sunday"
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Calendar Details - {team?.name}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Calendar Info */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Calendar1Icon />
              {calendarData.name}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Timezone:</span> {calendarData.timezone}
              </div>
              <div>
                <span className="text-gray-500">Status:</span> 
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  calendarData.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {calendarData.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Business Hours ({calendarData.hours?.length || 0})
            </h4>
            {calendarData.hours && calendarData.hours.length > 0 ? (
              <div className="space-y-2">
                {calendarData.hours
                  .sort((a, b) => a.weekday - b.weekday || a.start_min - b.start_min)
                  .map((hour, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">{WEEKDAY_NAMES[hour.weekday]}</span>
                      <span className="text-blue-600">
                        {formatTime(hour.start_min)} - {formatTime(hour.end_min)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No business hours configured</p>
            )}
          </div>

          {/* Holidays */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Holidays ({calendarData.holidays?.length || 0})
            </h4>
            {calendarData.holidays && calendarData.holidays.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {calendarData.holidays
                  .sort((a, b) => a.date_iso.localeCompare(b.date_iso))
                  .map((holiday, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">{holiday.date_iso}</span>
                      <span className="text-gray-600">{holiday.name || 'Unnamed Holiday'}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No holidays configured</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};