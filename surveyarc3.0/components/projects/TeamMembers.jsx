import React from "react";
import { descendingComparator, getComparator, getId, getRole   } from "@/utils/projectUtils";

export function TeamMembers({ members, byUid }) {
  if (!members || members.length === 0) {
    return <span className="text-sm text-gray-400">No members</span>;
  }

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

  const displayMembers = members.slice(0, 3);
  const remainingCount = members.length - 3;

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        {displayMembers.map((m, idx) => {
          const label = memberLabel(m);
          const email = memberEmail(m);
          const avatarText = memberAvatarText(m);
          
          return (
            <div
              key={idx}
              className="relative group"
            >
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-medium border-2 border-white">
                {avatarText}
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                  <div>{label}</div>
                  {email && <div className="text-gray-300">{email}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {remainingCount > 0 && (
        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium">
          +{remainingCount}
        </div>
      )}
      
      <span className="ml-1 text-sm text-gray-600">
        {members.length}
      </span>
    </div>
  );
}