"use client";
import React, { useRef, useState } from "react";
import { Upload, Plus, List, X, AlertCircle, Users, Mail } from "lucide-react";

export default function EmailListUploader({
  lists = [],
  listName,
  setListName,
  handleFileUpload,        // (e, targetListOrName)
  parsedContacts = [],
  error = "",
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState("new"); // "new" | "existing"
  const [selectedList, setSelectedList] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const openDialog = () => setDialogOpen(true);
  const closeDialog = () => setDialogOpen(false);

  const triggerFileInput = () => fileInputRef.current?.click();

  // Final file selection
  const onFileChange = (e) => {
    const target = uploadMode === "existing" ? selectedList : listName;
    closeDialog();
    handleFileUpload(e, target);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // Ask which list to use
    setDialogOpen(true);
  };

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    if (e.type === "dragleave") setDragActive(false);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Users className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Email List Manager</h3>
          <p className="text-gray-500 text-sm">Upload and organize your email contacts</p>
        </div>
      </div>

      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${
          dragActive ? "border-blue-500 bg-blue-50 scale-105" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className={`p-4 rounded-full ${dragActive ? "bg-blue-200" : "bg-gray-100"}`}>
            <Upload className={`w-8 h-8 ${dragActive ? "text-blue-600" : "text-gray-400"}`} />
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              {dragActive ? "Drop your file here" : "Upload Email List"}
            </h4>
            <p className="text-gray-500 mb-4">Drop your CSV or Excel file here, or click to browse</p>
          </div>

          <button
            onClick={openDialog}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4" />
            Choose File
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 font-medium">{error}</span>
        </div>
      )}

      {/* Last uploaded preview */}
      {parsedContacts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-600" />
            <h4 className="font-semibold text-gray-900">
              Uploaded Contacts ({parsedContacts.length})
            </h4>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {parsedContacts.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{row.Name || row.name}</td>
                    <td className="px-4 py-3 text-sm text-blue-600">{row.Email || row.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Upload Options</h3>
              <button onClick={() => setDialogOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Choose how to organize your contacts</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setUploadMode("new")}
                    className={`p-3 rounded-lg border-2 ${uploadMode === "new" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <Plus className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-sm font-medium">New List</div>
                  </button>
                  <button
                    onClick={() => setUploadMode("existing")}
                    className={`p-3 rounded-lg border-2 ${uploadMode === "existing" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <List className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-sm font-medium">Existing List</div>
                  </button>
                </div>
              </div>

              {uploadMode === "existing" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select existing list</label>
                  <select
                    value={selectedList}
                    onChange={(e) => setSelectedList(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a list…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.listName} ({l.contactIds?.length || 0})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New list name</label>
                  <input
                    type="text"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    placeholder="Enter list name…"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select file</label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={onFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button
                    onClick={triggerFileInput}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
                  >
                    <Upload className="w-4 h-4" />
                    Choose CSV or Excel file
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
