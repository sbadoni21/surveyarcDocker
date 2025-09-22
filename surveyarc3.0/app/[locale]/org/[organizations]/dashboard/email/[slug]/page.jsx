// app/[locale]/org/[organizations]/dashboard/email/[slug]/page.jsx
"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import EmailPage from "@/components/EmailPage";
import AllMailingOptions from "@/components/email-settings-components/AllMailingOptions";
import EmailTabsNav from "@/components/EmailTabsNav";
import EmailTemplates from "@/components/email-templates";
import EmailOnboardingDrawer from "@/components/email-page-components/EmailOnboardingDrawer";

export default function Page() {
  const params = useParams();
  const rawSlug = params?.slug;                 // string or string[]
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  let content = null;
  switch (slug) {
    case "contacts":
      content = <EmailPage/>;
      break;
    case "config":
      content = <AllMailingOptions />;
      break;
    case "templates":
      content = <EmailTemplates />;
      break;
    case "campaigns":
      content = <div className="p-6">Campaigns UI goes here.</div>;
      break;
    case "activity":
      content = <div className="p-6">Activity & logs goes here.</div>;
      break;
    default:
      content = <div className="p-6 text-gray-600">Unknown section.</div>;
  }

  return (
    <div className="min-h-screen">
      <EmailTabsNav /> 
      <div className="max-w-screen-2xl mx-auto px-4 py-6">{content}</div>
    </div>
  );
}
