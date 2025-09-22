"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import React from "react";

export default function WhatsAppTabsNav() {
  const pathname = usePathname();
  const params = useParams();
  const base = `/` + [params.locale, "org", params.organizations, "dashboard", "whatsapp"].filter(Boolean).join("/");

  const tabs = [
    { slug: "contacts", label: "Contacts" },
    { slug: "lists",    label: "Lists" },
    { slug: "config",   label: "Config" },
    { slug: "templates",   label: "Template" },
  ];

  return (
    <div className="border-b bg-white">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex gap-6">
          {tabs.map(t => {
            const href = `${base}/${t.slug}`;
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={t.slug}
                href={href}
                className={`py-3 border-b-2 -mb-px transition ${
                  active ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
