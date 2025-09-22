"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function WhatsAppIndex() {
  const router = useRouter();
  const { locale, organizations } = useParams();

  useEffect(() => {
    // redirect to default tab
    router.replace(`/${locale}/org/${organizations}/dashboard/whatsapp/contacts`);
  }, [router, locale, organizations]);

  return null;
}
