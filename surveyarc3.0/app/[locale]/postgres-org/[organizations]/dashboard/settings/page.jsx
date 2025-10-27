"use client";
import Organization from "@/components/setting/OrganizationForm";
import Policy from "@/components/setting/Policy";
import SettingTeam from "@/components/setting/SettingTeam";
import Subscription from "@/components/setting/Subscription";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import React, { useEffect, useState } from "react";

export default function SettingsPage() {
  const { user, updateUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("Profile");

  const [userData, setUserData] = useState({
    username: user?.displayName || "",
    email: user?.email || "",
    company: user?.company || "",
    website: user?.website || "",
    photoURL: user?.photoURL || "",
  });

  const { getById, create, update } = useOrganisation();

  const [orgData, setOrgData] = useState({
    orgName: "",
    websiteUrl: "",
  });

  useEffect(() => {
    const fetchOrgData = async () => {
      if (!user?.orgId) return;

      let org = await getById(user.orgId);
      if (!org) {
        await create({ id: user.orgId, orgName: "", websiteUrl: "" });
        org = await getById(user.orgId);
      }

      setOrgData({
        orgName: org.orgName || "",
        websiteUrl: org.websiteUrl || "",
      });

      setUserData({
        username: user.displayName || "",
        email: user.email || "",
        company: org.orgName || "",
        website: org.websiteUrl || "",
        photoURL: user.photoURL || "",
      });
    };

    fetchOrgData();
  }, [user]);

  const renderProfileTab = () => (
    <div className="mt-8 dark:bg-[#1A1A1E] bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold dark:text-[#96949C] text-slate-800">Your Profile</h2>
      <p className="text-sm dark:text-[#5B596A] text-[#8C8A97] mb-6">
        Update your profile settings here
      </p>
      <hr className="mb-4 dark:hidden" />
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-20">
          <label className="w-60 font-medium dark:text-[#96949C] text-xl">Profile picture</label>
          <div className="flex items-center gap-4">
            {userData.photoURL ? (
              <img
                src={userData.photoURL}
                alt="Profile"
                className="w-12 h-12 rounded-full object-cover border"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/default-avatar.png";
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-300 flex items-center justify-center text-white font-semibold">
                {userData.username?.[0]?.toUpperCase() || "U"}
              </div>
            )}

            {isEditing && (
              <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white text-sm font-medium text-slate-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 transition-all duration-150">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const maxSizeInBytes = 1024 * 1024;

                    if (file.size > maxSizeInBytes) {
                      alert("Profile photo must be less than 1MB in size.");
                      return;
                    }

                    setIsUploading(true);

                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setUserData((prev) => ({
                        ...prev,
                        photoURL: reader.result,
                      }));
                      setIsUploading(false);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                {isUploading ? "Uploading..." : "Upload Logo"}
              </label>
            )}

            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isEditing
                    ? "bg-black dark:bg-[#96949C] text-white"
                    : "bg-black dark:bg-[#96949C] text-white hover:bg-gray-900"
                }`}
                onClick={async () => {
                  if (isEditing && user?.uid && user?.orgId) {
                    setIsSaving(true);
                    await updateUser(user.uid, {
                      displayName: userData.username,
                      email: userData.email,
                      photoURL: userData.photoURL,
                    });

                    if (
                      userData.company !== orgData.orgName ||
                      userData.website !== orgData.websiteUrl
                    ) {
                      await update(user.orgId, {
                        orgName: userData.company,
                        websiteUrl: userData.website,
                      });
                    }

                    alert("Profile updated successfully!");
                    setIsSaving(false);
                  }

                  setIsEditing(!isEditing);
                }}
                disabled={isUploading || isSaving}
              >
                {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Edit"}
              </button>

              {isEditing && (
                <button
                  className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {["username", "email", "company", "website"].map((field) => (
          <div
            key={field}
            className="flex flex-col sm:flex-row sm:items-center gap-20"
          >
            <label htmlFor={field} className="w-60 font-medium dark:text-[#96949C] text-xl">
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </label>
            <input
              id={field}
              type="text"
              disabled={!isEditing}
              className={`w-full max-w-md border py-3 border-[#8C8A97] dark:bg-[#1A1A1E] dark:text-[#8C8A97] rounded-md px-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                !isEditing ? "bg-gray-100 cursor-not-allowed" : "bg-white"
              }`}
              value={userData[field]}
              onChange={(e) =>
                setUserData((prev) => ({ ...prev, [field]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "Profile":
        return renderProfileTab();
      case "Organization":
        return (
          <div className="mt-8 text-slate-600">
            <Organization />
          </div>
        );
      case "Subscription":
        return (
          <div className="mt-8 text-slate-600">
            <Subscription />
          </div>
        );
      case "Teams":
        return (
          <div className="mt-8 text-slate-600">
            <SettingTeam />
          </div>
        );
      case "Privacy policy":
        return (
          <div className="mt-8 text-slate-600">
            <Policy />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen dark:bg-[#121214] bg-[#F8F8F8] p-8">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-[#CBC9DE]">Settings</h1>
      <p className="text-sm text-slate-500">Manage your account settings</p>

      <div className="mt-6 flex gap-2 border dark:bg-[#1A1A1E] dark:border-[#8C8A97] dark:border bg-white rounded-xl p-1 w-fit">
        {[
          "Profile",
          "Organization",
          "Subscription",
          "Teams",
          "Privacy policy",
        ].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab
                ? "bg-[#f5f5f5] dark:bg-[#96949C] dark:text-[#121214] text-[#19162F]"
                : "text-slate-600 dark:hover:dark:bg-[#96949C] dark:hover:text-[#121214] hover:bg-slate-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {renderTabContent()}
    </div>
  );
}
