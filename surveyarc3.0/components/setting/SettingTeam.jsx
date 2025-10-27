"use client";
import React, { useEffect, useState } from "react";

import TeamInvite from "./TeamInvite";
import { FaUsers } from "react-icons/fa";
import OwnerShipTransfer from "./OwnerShipTransfer";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";

const SettingTeam = () => {
  const { user } = useUser();
  const { getById } = useOrganisation();
  const [orgData, setOrgData] = useState(null);

  useEffect(() => {
    const fetchOrg = async () => {
      if (!user?.orgId) return;
      const org = await getById(user.orgId);
      setOrgData(org);
    };

    fetchOrg();
  }, [user]);

  if (!orgData) return null;

  const teamName = orgData.orgName || "Unnamed Organization";
  const teamOwner = orgData.ownerName || orgData?.name || "Owner";
  const totalMembers = orgData.teamMembers?.length || 0;
  const teamLimit = orgData.quota?.teamMembers || 5;

  return (
    <div className="space-y-6 mt-8">
      <div className="bg-white dark:bg-[#1A1A1E] border dark:border-[#96949C3B] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
          <FaUsers className="text-orange-500" />
          <span className="dark:text-[#CBC9DE] text-2xl">Team overview</span>
        </div>
        <div className="grid grid-cols-3 text-sm text-slate-700 gap-4">
          <div>
            <p className="text-slate-400">Oraganization name</p>
            <p className="font-medium mt-1">{teamName}</p>
          </div>
          <div>
            <p className="text-slate-400">Team owner</p>
            <p className="font-medium mt-1">{teamOwner}</p>
          </div>
          <div>
            <p className="text-slate-400">Total members</p>
            <p className="font-medium mt-1">
              {totalMembers}/{teamLimit}
            </p>
          </div>
        </div>
      </div>

      <TeamInvite />

      <OwnerShipTransfer orgData={orgData} />
    </div>
  );
};

export default SettingTeam;
