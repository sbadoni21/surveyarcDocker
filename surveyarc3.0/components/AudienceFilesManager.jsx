"use client";

import React, { useState, useEffect } from "react";
import CampaignModel from "@/models/postGresModels/campaignModel";

const AudienceFilesManager = ({ orgId, onSelectFile }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load files on mount
  useEffect(() => {
    if (orgId) {
      loadFiles();
    }
  }, [orgId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // You'll need to add this method to CampaignModel
      const response = await fetch(
        `/api/post-gres-apis/audience-files?org_id=${orgId}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load audience files");
      }

      const data = await response.json();
      setFiles(data.items || []);
    } catch (err) {
      console.error("Error loading files:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/post-gres-apis/audience-files/${fileId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // Reload files
      await loadFiles();
      alert("File deleted successfully");
    } catch (err) {
      console.error("Error deleting file:", err);
      alert("Failed to delete file: " + err.message);
    }
  };

  const handlePreview = (file) => {
    setSelectedFile(file);
    setShowPreview(true);
  };

  const filteredFiles = files.filter((file) =>
    file.audience_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading audience files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-medium">Error Loading Files</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
        <button
          onClick={loadFiles}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Audience Files (B2C)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {files.length} uploaded file{files.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={loadFiles}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>🔄</span>
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search audience files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-gray-600 font-medium">No audience files found</p>
          <p className="text-sm text-gray-500 mt-1">
            {searchQuery
              ? "Try a different search term"
              : "Upload a CSV or Excel file to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onSelect={onSelectFile}
              onDelete={handleDelete}
              onPreview={handlePreview}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedFile && (
        <PreviewModal
          file={selectedFile}
          onClose={() => {
            setShowPreview(false);
            setSelectedFile(null);
          }}
        />
      )}
    </div>
  );
};

// ============================================
// FILE CARD COMPONENT
// ============================================
const FileCard = ({ file, onSelect, onDelete, onPreview }) => {
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all hover:shadow-lg p-4">
      {/* File Icon & Type */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
            {file.file_type === "csv" ? "📊" : "📈"}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 line-clamp-1">
              {file.audience_name || "Untitled"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              .{file.file_type} • {file.row_count} rows
            </div>
          </div>
        </div>
      </div>

      {/* File Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Uploaded:</span>
          <span className="text-gray-900 font-medium">
            {formatDate(file.uploaded_at)}
          </span>
        </div>
        
        {file.header_row && file.header_row.length > 0 && (
          <div className="text-sm">
            <span className="text-gray-600">Columns:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {file.header_row.slice(0, 3).map((col, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {col}
                </span>
              ))}
              {file.header_row.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                  +{file.header_row.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onSelect && (
          <button
            onClick={() => onSelect(file)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Select
          </button>
        )}
        <button
          onClick={() => onPreview(file)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
          title="Preview"
        >
          👁️
        </button>
        <button
          onClick={() => onDelete(file.id)}
          className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors text-sm"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

// ============================================
// PREVIEW MODAL COMPONENT
// ============================================
const PreviewModal = ({ file, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {file.audience_name || "Untitled"}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {file.row_count} rows • {file.header_row?.length || 0} columns
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {/* File Details */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">File Details</h4>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <div className="text-sm text-gray-600">File Type</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {file.file_type.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Row Count</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {file.row_count.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Uploaded</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {new Date(file.uploaded_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">File ID</div>
                  <div className="font-mono text-xs text-gray-700 mt-1">
                    {file.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Column Headers */}
            {file.header_row && file.header_row.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Columns ({file.header_row.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {file.header_row.map((col, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Info */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Validation Status</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${file.header_row?.includes('email') ? '✅' : '⚠️'}`}></span>
                  <span className="text-sm text-gray-700">
                    Email column: {file.header_row?.includes('email') ? 'Found' : 'Not found'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${file.header_row?.includes('phone') ? '✅' : '⚠️'}`}></span>
                  <span className="text-sm text-gray-700">
                    Phone column: {file.header_row?.includes('phone') ? 'Found' : 'Not found'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${file.header_row?.includes('name') ? '✅' : 'ℹ️'}`}></span>
                  <span className="text-sm text-gray-700">
                    Name column: {file.header_row?.includes('name') ? 'Found (optional)' : 'Not found (optional)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudienceFilesManager;