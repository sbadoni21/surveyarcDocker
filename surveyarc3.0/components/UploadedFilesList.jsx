// components/UploadedFilesList.jsx
"use client";

import React, { useState, useEffect } from "react";
import CampaignModel from "@/models/postGresModels/campaignModel";

const UploadedFilesList = ({ orgId, onSelectFile }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (orgId) {
      loadFiles();
    }
  }, [orgId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      // You'll need to add this method to CampaignModel
      const response = await fetch(
        `/api/post-gres-apis/audience-files?org_id=${orgId}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      
      if (!response.ok) throw new Error("Failed to load files");
      
      const data = await response.json();
      setFiles(data.items || []);
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    if (onSelectFile) {
      onSelectFile(file);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Previously Uploaded Files ({files.length})
        </h3>
        <button
          onClick={loadFiles}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Files List */}
      {files.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-4xl mb-2">📁</div>
          <p className="text-sm">No files uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg">
          {files.map((file) => (
            <div
              key={file.id}
              className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedFile?.id === file.id ? "bg-blue-50 border-blue-200" : ""
              }`}
              onClick={() => handleFileSelect(file)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {/* File Name */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {file.file_type === "csv" ? "📄" : "📊"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {file.audience_name || "Unnamed File"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.row_count?.toLocaleString() || 0} rows •{" "}
                        {file.header_row?.length || 0} columns •{" "}
                        {formatDate(file.uploaded_at)}
                      </div>
                    </div>
                  </div>

                  {/* Columns Preview */}
                  {file.header_row && file.header_row.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {file.header_row.slice(0, 5).map((col, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                        >
                          {col}
                        </span>
                      ))}
                      {file.header_row.length > 5 && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                          +{file.header_row.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPreview(file);
                    }}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    title="Preview details"
                  >
                    👁️ View
                  </button>
                  
                  {selectedFile?.id === file.id && (
                    <span className="text-green-600 text-sm">✓</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">
                File Details
              </h3>
              <button
                onClick={() => setShowPreview(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* File Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                    File Name
                  </div>
                  <div className="text-sm text-gray-900 font-medium">
                    {showPreview.audience_name || "Unnamed"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                    File Type
                  </div>
                  <div className="text-sm text-gray-900 font-medium uppercase">
                    {showPreview.file_type || "N/A"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                    Total Rows
                  </div>
                  <div className="text-sm text-gray-900 font-medium">
                    {showPreview.row_count?.toLocaleString() || 0}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                    Uploaded At
                  </div>
                  <div className="text-sm text-gray-900 font-medium">
                    {formatDate(showPreview.uploaded_at)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                    File ID
                  </div>
                  <div className="text-xs text-gray-600 font-mono">
                    {showPreview.id}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">
                    Storage Path
                  </div>
                  <div className="text-xs text-gray-600 font-mono truncate">
                    {showPreview.file_url || "N/A"}
                  </div>
                </div>
              </div>

              {/* Columns */}
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold mb-2">
                  Columns ({showPreview.header_row?.length || 0})
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border">
                  {showPreview.header_row && showPreview.header_row.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {showPreview.header_row.map((col, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm text-gray-700 font-medium"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No columns data</div>
                  )}
                </div>
              </div>

              {/* Column Validation */}
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold mb-2">
                  Column Validation
                </div>
                <div className="space-y-2">
                  {showPreview.header_row?.includes("email") && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                      <span>✓</span>
                      <span>Email column found - Ready for email campaigns</span>
                    </div>
                  )}
                  {showPreview.header_row?.includes("phone") && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                      <span>✓</span>
                      <span>Phone column found - Ready for SMS/WhatsApp campaigns</span>
                    </div>
                  )}
                  {showPreview.header_row?.includes("name") && (
                    <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded">
                      <span>💡</span>
                      <span>Name column found - Personalization available</span>
                    </div>
                  )}
                  {!showPreview.header_row?.includes("email") &&
                    !showPreview.header_row?.includes("phone") && (
                      <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
                        <span>⚠️</span>
                        <span>
                          Missing required columns (email or phone)
                        </span>
                      </div>
                    )}
                </div>
              </div>

              {/* Metadata */}
              {showPreview.meta_data &&
                Object.keys(showPreview.meta_data).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase font-semibold mb-2">
                      Metadata
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border">
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(showPreview.meta_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => {
                  handleFileSelect(showPreview);
                  setShowPreview(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Select This File
              </button>
              <button
                onClick={() => setShowPreview(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadedFilesList;