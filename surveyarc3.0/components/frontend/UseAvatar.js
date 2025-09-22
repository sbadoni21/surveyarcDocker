"use client";
import React from "react";
import Link from "next/link";
import { getAvatarColor, getInitials } from "@/utils/avatarutils";
import { usePathname } from "next/navigation";

export default function UserAvatar({ fullName = "User", orgID }) {
  const initials = getInitials(fullName);
  const bgColor = getAvatarColor(fullName);
  const pathname = usePathname();
  const locale = pathname.split("/")[1]; 

  return (
    <Link href={`/${locale}/org/${orgID}/dashboard/settings`}>
      <div
        className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center cursor-pointer shadow-sm hover:shadow-md transition"
        style={{ backgroundColor: bgColor }}
        title={fullName}
      >
        <span className="text-white font-semibold text-sm md:text-base">
          {initials}
        </span>
      </div>
    </Link>
  );
}
