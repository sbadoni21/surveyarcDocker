import { Calendar, Clock, Timer } from "lucide-react";

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

// Calendar Status Display Component
export default function CalendarStatusChip({ calendar, onClick }) {
  if (!calendar) {
    return (
      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        No Calendar
      </span>
    );
  }

  const hoursCount = calendar.hours_count || 0;
  const holidaysCount = calendar.holidays_count || 0;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onClick}
        className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-blue-200 transition-colors"
        title={`View ${calendar.name} calendar details`}
      >
        <Calendar className="w-3 h-3" />
        {calendar.name}
      </button>
      {hoursCount > 0 && (
        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {hoursCount}h
        </span>
      )}
      {holidaysCount > 0 && (
        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <Timer className="w-2.5 h-2.5" />
          {holidaysCount}
        </span>
      )}
    </div>
  );
}