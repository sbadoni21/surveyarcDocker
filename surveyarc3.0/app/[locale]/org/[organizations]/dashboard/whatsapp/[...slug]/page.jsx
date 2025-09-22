"use client";

import React from "react";
import { useParams } from "next/navigation";
import WhatsAppContacts from "@/components/whatsapp/WhatsAppContacts";
import WhatsAppConfig from "@/components/whatsapp/WhatsAppConfig";
import WhatsAppLists from "@/components/whatsapp/WhatsAppLists";
import WhatsAppTabsNav from "@/components/whatsapp/WhatsAppTabsNav";
import WhatsAppTemplates from "@/components/whatsapp/WhatsAppTemplates";


export default function Page() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  
  let content = null;
  switch (slug) {
    case "contacts":
      content = <WhatsAppContacts />;
      break;
    case "config":
      content = <WhatsAppConfig />;
      break;
    case "lists":
      content = <WhatsAppLists />;
      break;
    case "templates":
      content = <WhatsAppTemplates />;
      break;
    default:
      content = <div className="p-6 text-gray-600">Unknown section.</div>;
  }

  return (
    <div className="min-h-screen">
      <WhatsAppTabsNav />
      <div className="max-w-screen-2xl mx-auto px-4 py-6">{content}</div>
    </div>
  );
}
