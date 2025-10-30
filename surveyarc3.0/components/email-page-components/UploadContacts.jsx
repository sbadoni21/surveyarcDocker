"use client";
import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { X } from "lucide-react";
import { LoadingOverlay } from "@/utils/loadingOverlay";

/* ----------------------------- PARSE HELPERS ----------------------------- */

const parseFile = (file) =>
  new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header) => header.trim(),
        complete: (res) => resolve(res.data),
        error: reject,
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "binary" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsBinaryString(file);
    } else {
      reject(new Error("Unsupported file type"));
    }
  });

/** ✅ Normalizer */
const normalizeRow = (row) => {
  const name =
    row.Name ??
    row.name ??
    row.FullName ??
    row["Full Name"] ??
    row.NAME ??
    "";

  const email =
    row.Email ??
    row.email ??
    row["E-mail"] ??
    row.EMAIL ??
    "";

  const phone =
    row.Phone ??
    row.phone ??
    row["Phone Number"] ??
    row.Mobile ??
    "";

  const platform =
    row.Platform ??
    row.platform ??
    row["Social Platform"] ??
    "";

  const handle =
    row.Handle ??
    row.handle ??
    row["Social Handle"] ??
    row.Username ??
    "";

  const link =
    row.Link ??
    row.link ??
    row.URL ??
    row["Profile URL"] ??
    "";

  return {
    raw: row,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    platform: String(platform).trim(),
    handle: String(handle).trim(),
    link: String(link).trim(),
  };
};

/* ------------------------------ Upload Modal ------------------------------ */
export const UploadModal = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  existingListName = "",
  isAddingToList = false 
}) => {
  const [listName, setListName] = useState("");
  const [parsedContacts, setParsedContacts] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [uploadType, setUploadType] = useState("auto");
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Set list name when adding to existing list
  useEffect(() => {
    if (isAddingToList && existingListName) {
      setListName(existingListName);
    } else {
      setListName("");
    }
  }, [isAddingToList, existingListName, isOpen]);

  const isValidEmail = (val) => {
    if (!val) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const isValidPhone = (val) => {
    if (!val) return false;
    const cleaned = String(val).replace(/[\s\-()]/g, "");
    return /^[+]?[0-9]{8,15}$/.test(cleaned);
  };

  /* ✅ Parse + validate + de-dupe */
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);

    try {
      const rows = await parseFile(file);

      if (!rows || rows.length === 0) {
        alert("No data found in file");
        setIsParsing(false);
        return;
      }

      const normalized = [];
      const skipped = [];

      for (const r of rows) {
        const obj = normalizeRow(r);

        // Skip empty rows
        if (!obj.name && !obj.email && !obj.phone && !obj.handle) {
          continue;
        }

        // Name is required
        if (!obj.name) {
          skipped.push(r);
          continue;
        }

        // Type-specific validation
        if (uploadType === "email") {
          if (!obj.email || !isValidEmail(obj.email)) {
            skipped.push(r);
            continue;
          }
        } else if (uploadType === "phone") {
          if (!obj.phone || !isValidPhone(obj.phone)) {
            skipped.push(r);
            continue;
          }
        } else if (uploadType === "social") {
          if (!obj.platform || !obj.handle) {
            skipped.push(r);
            continue;
          }
        } else if (uploadType === "auto") {
          const hasValidEmail = obj.email && isValidEmail(obj.email);
          const hasValidPhone = obj.phone && isValidPhone(obj.phone);
          const hasValidSocial = obj.platform && obj.handle;

          if (!hasValidEmail && !hasValidPhone && !hasValidSocial) {
            skipped.push(r);
            continue;
          }
        }

        normalized.push(obj);
      }

      // ✅ Dedupe based on email, phone, or social handle
      const seen = new Set();
      const deduped = [];

      for (const row of normalized) {
        const keys = [];
        
        if (row.email && isValidEmail(row.email)) {
          keys.push(`email:${row.email.toLowerCase()}`);
        }
        if (row.phone && isValidPhone(row.phone)) {
          const cleaned = row.phone.replace(/[\s\-()]/g, "");
          keys.push(`phone:${cleaned}`);
        }
        if (row.platform && row.handle) {
          keys.push(`social:${row.platform.toLowerCase()}:${row.handle.toLowerCase()}`);
        }

        if (keys.length === 0) continue;

        const isDuplicate = keys.some(key => seen.has(key));
        
        if (!isDuplicate) {
          keys.forEach(key => seen.add(key));
          deduped.push(row);
        }
      }

      setParsedContacts(deduped);
      setSkippedRows(skipped);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert(`Error parsing file: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  /* ✅ Prepare payload for upload */
  const prepareAndUpload = async () => {
    if (!listName.trim() && !isAddingToList) {
      alert("Please enter a list name");
      return;
    }

    setIsUploading(true);

    try {
      const contacts = [];
      const phones = [];
      const emails = [];
      const socials = [];

      parsedContacts.forEach((c) => {
        const contactId = crypto.randomUUID();

        let primaryIdentifier = null;
        let contactType = null;

        // Determine primary contact method
        if (uploadType === "email" && c.email) {
          primaryIdentifier = c.email;
          contactType = "email";
        } else if (uploadType === "phone" && c.phone) {
          primaryIdentifier = c.phone;
          contactType = "phone";
        } else if (uploadType === "social" && c.handle) {
          primaryIdentifier = c.handle;
          contactType = c.platform?.toLowerCase() || "unknown";
        } else if (uploadType === "auto") {
          if (c.email && isValidEmail(c.email)) {
            primaryIdentifier = c.email;
            contactType = "email";
          } else if (c.phone && isValidPhone(c.phone)) {
            primaryIdentifier = c.phone;
            contactType = "phone";
          } else if (c.handle && c.platform) {
            primaryIdentifier = c.handle;
            contactType = c.platform?.toLowerCase() || "unknown";
          }
        }

        contacts.push({
          contactId,
          name: c.name,
          primaryIdentifier,
          contactType,
          status: "active",
          meta: {},
        });

        // ✅ Add emails
        if (c.email && isValidEmail(c.email)) {
          emails.push({
            id: crypto.randomUUID(),
            contactId,
            email: c.email,
            emailLower: c.email.toLowerCase(),
            isPrimary: primaryIdentifier === c.email,
            isVerified: false,
            status: "active",
            isBlocked: false,
          });
        }

        // ✅ Add phones
        if (c.phone && isValidPhone(c.phone)) {
          const cleaned = c.phone.replace(/[\s\-()]/g, "");
          let countryCode = "+91"; // Default
          let phoneNumber = cleaned;

          if (cleaned.startsWith("+")) {
            const match = cleaned.match(/^(\+\d{1,3})(\d+)$/);
            if (match) {
              countryCode = match[1];
              phoneNumber = match[2];
            }
          }

          phones.push({
            id: crypto.randomUUID(),
            contactId,
            countryCode,
            phoneNumber,
            isPrimary: primaryIdentifier === c.phone,
            isWhatsapp: false,
            isVerified: false,
            isBlocked: false,
          });
        }

        // ✅ Add socials
        if (c.platform && c.handle) {
          socials.push({
            id: crypto.randomUUID(),
            contactId,
            platform: c.platform.toLowerCase(),
            handle: c.handle,
            link: c.link || "",
            isPrimary: primaryIdentifier === c.handle,
            isBlocked: false,
          });
        }
      });

      await onUpload({
        listName: listName.trim(),
        uploadType,
        contacts,
        contactPhones: phones,
        contactEmails: emails,
        contactSocials: socials,
      });

      // Reset and close
      handleClose();
    } catch (error) {
      console.error("Upload error:", error);
      alert(error.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

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
              onClick={prepareAndUpload}
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