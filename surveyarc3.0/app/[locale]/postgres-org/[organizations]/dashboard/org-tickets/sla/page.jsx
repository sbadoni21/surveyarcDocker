"use client";
import SLAAdminPanel from "@/components/sla/SLAAdminPanel";
import { usePathname } from "next/navigation";
import { SLAMakingProvider } from "@/providers/slaMakingProivder";

export default function SLASettingsPage() {
  const path = usePathname();
  const orgId = path.split("/")[3];

  return (
    <SLAMakingProvider>
      <div className="mx-auto">
        <div className="space-y-4"> 
          <div className="border border-gray-300 rounded-lg p-4 bg-white">
            <SLAAdminPanel orgId={orgId} />
          </div>
        </div>
      </div>
    </SLAMakingProvider>
  );
}