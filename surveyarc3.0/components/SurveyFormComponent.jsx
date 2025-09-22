import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SurveyFormComponent({
  show,
  name,
  time,
  setName,
  setTime,
  loading,
  isEditing,
  handleSubmit,
  handleCancel, // Add this prop for cancel functionality
}) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.25 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 mx-4"
          >
            {/* Form Title */}
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
              {isEditing ? "Edit Survey" : "Create New Survey"}
            </h2>

            {/* Input: Survey Name */}
            <input
              className="w-full px-4 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-gray-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter survey name"
              disabled={loading}
            />

            {/* Input: Survey Duration */}
            <input
              className="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-gray-100"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Enter survey duration (e.g. 10 min)"
              disabled={loading}
            />

            {/* Button Container */}
            <div className="flex gap-3">
              {/* Cancel Button */}
              <button
                className="flex-1 py-2 px-4 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>

              {/* Submit Button */}
              <button
                className={`flex-1 py-2 px-4 text-white rounded-md font-semibold transition ${
                  loading || !name.trim() || !time.trim()
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={handleSubmit}
                disabled={loading || !name.trim() || !time.trim()}
              >
                {loading ? "Saving..." : isEditing ? "Update Survey" : "Create Survey"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}