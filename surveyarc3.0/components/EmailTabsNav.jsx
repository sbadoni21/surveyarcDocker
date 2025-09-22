"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { TbSettingsCog, TbLayoutDistributeHorizontal } from "react-icons/tb";
import EmailOnboardingDrawer from "./email-page-components/EmailOnboardingDrawer";
import { useState } from "react";

export default function EmailTabsNav() {
  const pathname = usePathname();

  // Find the "/email" base in any nested path (e.g., /en/org/:id/dashboard/email/...)
  const segs = pathname.split("/").filter(Boolean);
  const emailIdx = segs.lastIndexOf("email");
  const base = emailIdx >= 0 ? "/" + segs.slice(0, emailIdx + 1).join("/") : "/email";
  const activeSlug = segs[emailIdx + 1] || "overview";
  const [open, setOpen] = useState(false);

  const tabs = [
    { id: "contacts", label: "Contacts & Lists", icon: <Icon icon="mdi:account-group-outline" width="18" height="18" /> },
    { id: "config", label: "Email Configurations", icon: <TbSettingsCog className="w-4 h-4" /> },
    { id: "templates", label: "Templates", icon: <Icon icon="mdi:file-document-edit-outline" width="18" height="18" /> },
    { id: "campaigns", label: "Campaigns", icon: <TbLayoutDistributeHorizontal className="w-4 h-4" /> },
    { id: "activity", label: "Activity & Logs", icon: <Icon icon="mdi:history" width="18" height="18" /> },
  ];

  return (
    <div className="w-full bg-white dark:bg-[#1A1A1E] border-b border-gray-200 dark:border-zinc-800">
      <div className=" mx-auto px-4 py-3 flex justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const href = `${base}/${t.id}`;
            const isActive = activeSlug === t.id;
            return (
              <Link
                key={t.id}
                href={href}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? "bg-[#ED7A13] text-white" : "text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"}`}
              >
                {t.icon}
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
          <button
          onClick={() => setOpen(true)}
          className="px-3 py-2 text-sm rounded-lg border hover:bg-orange-50"
        >
          Open Onboarding Checklist
        </button>

                      <EmailOnboardingDrawer open={open} onClose={() => setOpen(false)} />

      </div>
    </div>
  );
}
