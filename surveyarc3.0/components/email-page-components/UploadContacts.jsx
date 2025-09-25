// UploadContacts.jsx
"use client";
import React, { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, CheckCircle, AlertCircle, X } from "lucide-react";
import { LoadingOverlay } from "@/utils/loadingOverlay";
import { LoadingSpinner } from "@/utils/loadingSpinner";

const parseFile = (file) =>
  new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data),
        error: reject,
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet));
      };
      reader.readAsBinaryString(file);
    } else {
      reject(new Error("Unsupported file type"));
    }
  });

const normalizeRow = (row) => {
  // handle common header variants
  const rawEmail =
    row.Email ??
    row.email ??
    row["E-mail"] ??
    row["e-mail"] ??
    row["Email Address"] ??
    row["email address"] ??
    row["EMAIL"];

  const rawName =
    row.Name ??
    row.name ??
    row.FullName ??
    row["Full Name"] ??
    row["full name"] ??
    row["NAME"];

  const email = String(rawEmail || "").trim();
  const name = String(rawName || "").trim();

  if (!email) return null; // <- will be skipped
  return {
    name,
    email,
    emailLower: email.toLowerCase(),
    status: "active",
    meta: {},
  };
};

/* ------------------------------ Upload Modal ------------------------------ */
export const UploadModal = ({ isOpen, onClose, onUpload }) => {
  const [listName, setListName] = useState("");
  const [parsedContacts, setParsedContacts] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]); // rows that had no email
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const rows = await parseFile(file);

      const normalized = [];
      const skipped = [];

      for (const r of rows) {
        const n = normalizeRow(r);
        if (n) normalized.push(n);
        else skipped.push(r);
      }

      // de-dupe by email (in-file)
      const seen = new Set();
      const deduped = [];
      for (const c of normalized) {
        if (!seen.has(c.emailLower)) {
          seen.add(c.emailLower);
          deduped.push(c);
        }
      }

      setParsedContacts(deduped);
      setSkippedRows(skipped);
      setStep(2);
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Error parsing file. Please check the format and try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!listName.trim()) return;
    if (parsedContacts.length === 0) {
      alert("No valid contacts with an email were found in the file.");
      return;
    }

    setIsUploading(true);
    try {
      await onUpload({
        listName: listName.trim(),
        contacts: parsedContacts, // each contact has a valid email now
      });
      handleClose();
    } catch (error) {
      console.error("Error uploading:", error);
      try {
        const j = JSON.parse(error);
        alert(j.detail?.[0]?.msg || "Error uploading contacts.");
      } catch {
        alert("Error uploading contacts.");
      }
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-xl font-semibold">Upload Contact List</h3>
          <button
            onClick={handleClose}
            disabled={isUploading || isParsing}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 relative">
          {(isUploading || isParsing) && (
            <LoadingOverlay message={isUploading ? "Uploading contacts..." : "Parsing file..."} />
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">List Name</label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Enter list name"
                  disabled={isParsing}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Upload CSV / Excel</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    Drop your CSV or Excel file here, or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    disabled={isParsing}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`px-4 py-2 bg-orange-600 text-white rounded-lg cursor-pointer hover:bg-orange-700 transition-colors
                      ${isParsing ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    {isParsing ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        Parsing...
                      </span>
                    ) : (
                      "Choose File"
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h4 className="font-medium text-green-800">Valid Contacts</h4>
                  </div>
                  <p className="text-2xl font-bold text-green-800">{parsedContacts.length}</p>
                  <p className="text-sm text-green-600">Will be added to your database</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <h4 className="font-medium text-yellow-800">Skipped (no email)</h4>
                  </div>
                  <p className="text-2xl font-bold text-yellow-800">{skippedRows.length}</p>
                  <p className="text-sm text-yellow-600">Rows missing an email address</p>
                </div>
              </div>

              {parsedContacts.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Preview (first 10):</h5>
                  <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3">
                    {parsedContacts.slice(0, 10).map((c, idx) => (
                      <div key={idx} className="text-sm py-1">
                        {c.name || "(no name)"} — {c.email}
                      </div>
                    ))}
                    {parsedContacts.length > 10 && (
                      <div className="text-xs text-gray-500 mt-1">
                        +{parsedContacts.length - 10} more…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isUploading || isParsing}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {step === 2 && (
            <button
              onClick={handleUpload}
              disabled={!listName.trim() || isUploading || isParsing || parsedContacts.length === 0}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading && <LoadingSpinner size="sm" />}
              {isUploading ? "Creating List..." : "Create List"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
