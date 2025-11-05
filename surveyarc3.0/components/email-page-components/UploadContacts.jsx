"use client";
import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { LoadingOverlay } from "@/utils/loadingOverlay";
import { parseFile } from "@/utils/parseFile";
import { normalizeRow } from "@/utils/normalizeRow";
import { validateUploadedContacts } from "@/utils/validateContacts";

/* ✅ SAFE UUID */
const uuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now();
};

export const UploadModal = ({
  isOpen,
  onClose,
  onUpload,
  existingListName = "",
  isAddingToList = false,
  targetListId,
  existingContacts = [],
  existingEmails = [],
  existingPhones = [],
  existingSocials = [],
}) => {
  const [listName, setListName] = useState("");
  const [parsedContacts, setParsedContacts] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [uploadType, setUploadType] = useState("auto");
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    setListName(isAddingToList ? existingListName : "");
  }, [isOpen, isAddingToList, existingListName]);

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
  const isValidPhone = (v) => /^[+]?[0-9]{8,15}$/.test(String(v || "").replace(/[ \-()]/g, ""));

  /* ================== FILE PARSE ================== */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);

    try {
      const rows = await parseFile(file);
      if (!rows?.length) {
        alert("No data found in file");
        setIsParsing(false);
        return;
      }

      const valid = [];
      const skipped = [];

      for (const raw of rows) {
        const r = normalizeRow(raw);

        if (!r.name && !r.email && !r.phone && !r.handle) continue;
        if (!r.name) {
          skipped.push(raw);
          continue;
        }

        let okEmail = r.email && isValidEmail(r.email);
        let okPhone = r.phone && isValidPhone(r.phone);
        let okSocial = r.platform && r.handle;

        if (
          (uploadType === "email" && !okEmail) ||
          (uploadType === "phone" && !okPhone) ||
          (uploadType === "social" && !okSocial)
        ) {
          skipped.push(raw);
          continue;
        }

        if (uploadType === "auto" && !okEmail && !okPhone && !okSocial) {
          skipped.push(raw);
          continue;
        }

        valid.push(r);
      }

      // ✅ DEDUPE
      const seen = new Set();
      const dedup = [];

      valid.forEach((c) => {
        const keys = [];

        if (c.email && isValidEmail(c.email)) keys.push("email:" + c.email.toLowerCase());
        if (c.phone && isValidPhone(c.phone)) keys.push("phone:" + c.phone.replace(/[ \-()]/g, ""));
        if (c.platform && c.handle)
          keys.push("social:" + c.platform.toLowerCase() + ":" + c.handle.toLowerCase());

        if (!keys.length) return;
        const dup = keys.some((k) => seen.has(k));
        if (!dup) {
          keys.forEach((k) => seen.add(k));
          dedup.push(c);
        }
      });

      setParsedContacts(dedup);
      setSkippedRows(skipped);
      setStep(2);
    } catch (e) {
      alert("Parsing failed: " + e.message);
    }

    setIsParsing(false);
  };



/* ================== PREP + UPLOAD ================== */
const prepareAndUpload = async () => {
  try {
    console.log("🚀 Starting prepareAndUpload");

    setIsUploading(true);

    /* Build local contact data */
    const contacts = [];
    const contactEmails = [];
    const contactPhones = [];
    const contactSocials = [];

    console.log("📦 parsedContacts:", parsedContacts);

    parsedContacts.forEach((c, i) => {
      console.log(`\n==============================`);
      console.log(`📍 Processing Row #${i + 1}`, c);

      const contactId = uuid();
      let primary = null;
      let type = null;

      if (uploadType === "email" && c.email) {
        primary = c.email;
        type = "email";
      } else if (uploadType === "phone" && c.phone) {
        primary = c.phone;
        type = "phone";
      } else if (uploadType === "social" && c.handle) {
        primary = c.handle;
        type = c.platform?.toLowerCase() || "social";
      } else {
        if (c.email && isValidEmail(c.email)) {
          primary = c.email;
          type = "email";
        } else if (c.phone && isValidPhone(c.phone)) {
          primary = c.phone;
          type = "phone";
        } else if (c.handle && c.platform) {
          primary = c.handle;
          type = c.platform?.toLowerCase() || "social";
        }
      }

      console.log("➡️ primary:", primary, " type:", type);

      /* MAIN CONTACT OBJ */
      const contactObj = {
        contactId,
        name: c.name,
        primaryIdentifier: primary,
        contactType: type,
        status: "active",
        meta: {},
      };

      contacts.push(contactObj);
      console.log("✅ Contact Added:", contactObj);

      /* EMAIL RECORD */
      if (c.email && isValidEmail(c.email)) {
        const emailObj = {
          id: uuid(),
          contactId,
          email: c.email,
          emailLower: c.email.toLowerCase(),
          isPrimary: primary === c.email,
          isVerified: false,
          status: "active",
          isBlocked: false,
        };

        contactEmails.push(emailObj);
        console.log("📨 Email Added:", emailObj);
      }

      /* PHONE RECORD */
      if (c.phone && isValidPhone(c.phone)) {
        let cleaned = c.phone.replace(/[ \-()]/g, "");
        let countryCode = "+91";
        let number = cleaned;

        if (cleaned.startsWith("+")) {
          const match = cleaned.match(/^(\+\d{1,3})(\d+)$/);
          if (match) {
            countryCode = match[1];
            number = match[2];
          }
        }

        const phoneObj = {
          id: uuid(),
          contactId,
          countryCode,
          phoneNumber: number,
          isPrimary: primary === c.phone,
          isWhatsapp: false,
          isVerified: false,
          isBlocked: false,
        };

        contactPhones.push(phoneObj);
        console.log("📞 Phone Added:", phoneObj);
      }

      /* SOCIAL RECORD */
      if (c.platform && c.handle) {
        const socialObj = {
          id: uuid(),
          contactId,
          platform: c.platform.toLowerCase(),
          handle: c.handle,
          link: c.link || "",
          isPrimary: primary === c.handle,
          isBlocked: false,
        };

        contactSocials.push(socialObj);
        console.log("🌐 Social Added:", socialObj);
      }
    });

    /* ================== LOG BUILT DATA ================== */
    console.log("\n==============================");
    console.log("✅ FINAL BUILT STRUCTURES");
    console.log("contacts:", contacts);
    console.log("contactEmails:", contactEmails);
    console.log("contactPhones:", contactPhones);
    console.log("contactSocials:", contactSocials);


    /* ✅ RUN VALIDATOR */
    console.log("\n🔍 Running validateUploadedContacts...");
    const { toCreate, toUpdate, toSkip } = validateUploadedContacts({
      existingContacts,
      existingEmails,
      existingPhones,
      existingSocials,
      uploadedContacts: contacts,
    });

    console.log("\n✅ Validator Result:");
    console.log("🟢 toCreate:", toCreate);
    console.log("🟠 toUpdate:", toUpdate);
    console.log("🔵 toSkip:", toSkip);


    /* ✅ FINAL PAYLOAD */
    const payload = {
      listId: isAddingToList ? targetListId : null,
      listName,
      uploadType,

      contacts: toCreate,
      contactEmails,
      contactPhones,
      contactSocials,

      toUpdate,
      toSkip,

      isAddingToList,
    };

    console.log("\n📦 Final Payload to Backend:");
    console.log(payload);


    /* ✅ SEND TO BACKEND */
    await onUpload(payload);

    console.log("✅ Upload Completed");
    handleClose();
  } catch (e) {
    console.error("❌ Upload Failed:", e);
    alert(e.message);
  }

  setIsUploading(false);
  console.log("✅ Upload Finished");
};



  /* ================== CLOSE ================== */
  const handleClose = () => {
    if (isUploading || isParsing) return;
    onClose();
    setListName("");
    setParsedContacts([]);
    setSkippedRows([]);
    setStep(1);
    setUploadType("auto");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* HEADER */}
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            {isAddingToList ? `Add Contacts to "${existingListName}"` : "Upload Contact List"}
          </h3>
          <button 
            onClick={handleClose} 
            disabled={isUploading || isParsing}
            className="hover:bg-gray-100 p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 relative">
          {/* ✅ Enhanced Instructions */}
          {step === 1 && (
            <div className="mb-4 space-y-3">
              <div className="text-sm bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">📋 Required CSV/Excel Format</h4>
                <p className="text-blue-800 mb-3">Your file should contain the following columns:</p>
                
                <div className="bg-white p-3 rounded border border-blue-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">Name</span>
                    <span className="text-xs text-gray-600">Contact&apos;s full name (required)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded">Email</span>
                    <span className="text-xs text-gray-600">Email address (e.g., john@example.com)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-purple-100 px-2 py-1 rounded">Phone</span>
                    <span className="text-xs text-gray-600">Phone number with country code (e.g., +919876543210)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-orange-100 px-2 py-1 rounded">Platform</span>
                    <span className="text-xs text-gray-600">Social platform (instagram, facebook, linkedin, twitter)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-orange-100 px-2 py-1 rounded">Handle</span>
                    <span className="text-xs text-gray-600">Social media handle (e.g., @johndoe)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-orange-100 px-2 py-1 rounded">Link</span>
                    <span className="text-xs text-gray-600">Full social profile URL (optional)</span>
                  </div>
                </div>
              </div>

              <div className="text-sm bg-green-50 border border-green-200 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">✅ Example CSV Format</h4>
                <pre className="text-xs bg-white p-3 rounded border border-green-200 overflow-x-auto">
{`Name,Email,Phone,Platform,Handle,Link
John Doe,john@example.com,+919876543210,instagram,@johndoe,https://instagram.com/johndoe
Jane Smith,jane@example.com,+918765432109,linkedin,jane-smith,https://linkedin.com/in/jane-smith
Bob Wilson,bob@example.com,+917654321098,twitter,@bobwilson,https://twitter.com/bobwilson`}
                </pre>
              </div>

              <div className="text-sm bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <h4 className="font-semibold text-amber-900 mb-2">ℹ️ Important Notes</h4>
                <ul className="text-amber-800 space-y-1 text-xs list-disc list-inside">
                  <li>Each contact must have at least <strong>Name</strong> and one contact method (Email, Phone, or Social)</li>
                  <li>Email addresses will be validated (must contain @ and domain)</li>
                  <li>Phone numbers should be 8-15 digits (can include + for country code)</li>
                  <li>For social contacts, provide Platform and Handle (Link is optional)</li>
                  <li>Duplicate contacts (same email/phone/social) will be automatically removed</li>
                  <li>Invalid rows will be skipped and shown in the summary</li>
                </ul>
              </div>
            </div>
          )}

          {(isUploading || isParsing) && (
            <LoadingOverlay message={isUploading ? "Uploading..." : "Parsing..."} />
          )}

          {step === 1 && (
            <div className="space-y-4">
              {/* List Name - Only show if creating new list */}
              {!isAddingToList && (
                <div>
                  <label className="block text-sm font-medium mb-2">List Name</label>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="e.g., Marketing Leads 2024"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isParsing}
                  />
                </div>
              )}

              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium mb-2">Contact Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isParsing}
                >
                  <option value="auto">Auto detect</option>
                  <option value="email">Email Contacts</option>
                  <option value="phone">Phone Contacts</option>
                  <option value="social">Social Contacts</option>
                </select>
              </div>

              {/* File */}
              <div>
                <label className="block text-sm font-medium mb-2">Upload CSV / Excel</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={isParsing}
                  className="w-full px-3 py-2 border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-md border border-green-200">
                  <p className="text-green-700 font-medium text-lg">{parsedContacts.length}</p>
                  <p className="text-green-600 text-sm">Valid contacts</p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                  <p className="text-yellow-700 font-medium text-lg">{skippedRows.length}</p>
                  <p className="text-yellow-600 text-sm">Skipped rows</p>
                </div>
              </div>

              {/* Preview */}
              <div>
                <h4 className="font-medium mb-2">Preview (first 10 contacts)</h4>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {parsedContacts.slice(0, 10).map((c, i) => (
                      <div key={i} className="text-sm border-b p-3 hover:bg-gray-50 last:border-b-0">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-gray-600 text-xs mt-1 space-y-1">
                          {c.email && <div>📧 {c.email}</div>}
                          {c.phone && <div>📱 {c.phone}</div>}
                          {c.platform && <div>🔗 {c.platform}: {c.handle}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t flex justify-end gap-3">
          <button 
            onClick={handleClose}
            disabled={isUploading || isParsing}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          {step === 2 && (
            <button
              onClick={() => {console.log(targetListId), prepareAndUpload()}}
              disabled={isUploading || parsedContacts.length === 0 || (!isAddingToList && !listName.trim())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading..." : `${isAddingToList ? 'Add' : 'Upload'} ${parsedContacts.length} Contact${parsedContacts.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};