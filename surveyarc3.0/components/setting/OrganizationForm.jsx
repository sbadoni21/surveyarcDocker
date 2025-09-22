"use client";
import React, { useEffect, useState } from "react";
import { useUser } from "@/providers/UserPProvider";
import { useOrganisation } from "@/providers/organisationPProvider";

export default function OrganizationForm() {
  const { create, update, getById } = useOrganisation();
  const { user } = useUser();

  const [orgData, setOrgData] = useState({
    orgName: "",
    name: "",
    businessType: "",
    industry: "",
    photoURL: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchAndSetOrg = async () => {
      if (!user?.orgId) return;

      let orgDoc = await getById(user.orgId);

      if (!orgDoc) {
        await create({
          id: user.orgId,
          orgName: "",
          websiteUrl: "",
          photoURL: "",
        });
        orgDoc = await getById(user.orgId);
      }

      setOrgData({
        orgName: orgDoc?.orgName || "",
        name: orgDoc?.name || "",
        businessType: orgDoc?.businessType || "",
        industry: orgDoc?.industry || "",
        photoURL: orgDoc?.photoURL || "",
      });
    };

    fetchAndSetOrg();
  }, [user]);

  const handleChange = (field, value) => {
    setOrgData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.orgId) return;

    try {
      setIsSaving(true);
      await update(user.orgId, orgData);
      alert("Organization info updated successfully!");
      setIsEditing(false);
    } catch (err) {
      alert("Failed to save changes.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-8 bg-white dark:bg-[#1A1A1E] rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold dark:text-[#96949C] text-slate-800">
        Organization
      </h2>
      <p className="text-sm text-[#8C8A97] dark:text-[#5B596A] mb-6">
        Update your organization settings here
      </p>
      <hr className="mb-4" />

      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-20">
          <label className="w-60 font-medium dark:text-[#96949C] text-xl">
            Logo
          </label>
          <div className="flex items-center gap-4">
            {orgData.photoURL ? (
              <img
                src={orgData.photoURL}
                alt="Organization Logo"
                className="w-12 h-12 rounded-full object-cover border"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-300 flex items-center justify-center text-white font-semibold">
                {orgData.orgName?.[0]?.toUpperCase() || "O"}
              </div>
            )}

            {isEditing && (
              <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white text-sm font-medium text-slate-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 transition-all duration-150">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    setIsUploading(true);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setOrgData((prev) => ({
                        ...prev,
                        photoURL: reader.result,
                      }));
                      setIsUploading(false);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                Upload Logo
              </label>
            )}

            {isUploading && (
              <span className="text-sm text-gray-500">Uploading...</span>
            )}

            <div className="flex items-center gap-2">
              <button
                disabled={isSaving || isUploading}
                onClick={async () => {
                  if (isEditing) {
                    await handleSave();
                  } else {
                    setIsEditing(true);
                  }
                }}
                className={`px-6 py-2 rounded-md text-sm font-medium ${
                  isEditing
                    ? "bg-black dark:bg-[#96949C] text-white"
                    : "bg-black dark:bg-[#96949C] text-white hover:bg-gray-900"
                } disabled:opacity-50`}
              >
                {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Edit"}
              </button>

              {isEditing && (
                <button
                  disabled={isSaving || isUploading}
                  onClick={async () => {
                    if (user?.orgId) {
                      const orgDoc = await getById(user.orgId);
                      setOrgData({
                        orgName: orgDoc?.orgName || "",
                        name: orgDoc?.name || "",
                        businessType: orgDoc?.businessType || "",
                        industry: orgDoc?.industry || "",
                        photoURL: orgDoc?.photoURL || "",
                      });
                    }
                    setIsEditing(false);
                  }}
                  className="px-6 py-2 rounded-md bg-red-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
        {[
          { label: "Organization name", key: "orgName" },
          { label: "Owner name", key: "name" },
          { label: "Business type", key: "businessType" },
          { label: "Industry", key: "industry" },
        ].map(({ label, key }) => (
          <div
            key={key}
            className="flex flex-col sm:flex-row sm:items-center gap-20"
          >
            <label htmlFor={key} className="w-60 dark:text-[#96949C] font-medium text-xl">
              {label}
            </label>
            <input
              id={key}
              type="text"
              disabled={!isEditing || isSaving}
              className={`w-full max-w-md border py-3 border-[#8C8A97]  dark:bg-[#1A1A1E] dark:text-[#8C8A97] rounded-md px-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                !isEditing || isSaving
                  ? "bg-gray-100 cursor-not-allowed"
                  : "bg-white"
              }`}
              value={orgData[key]}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
