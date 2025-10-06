"use client";
import React, { useRef, useState } from "react";
import { FiPlusSquare } from "react-icons/fi";
import { IoCopyOutline } from "react-icons/io5";
import { MdOutlineFileDownload } from "react-icons/md";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";
import { Settings } from "lucide-react"; // settings icon

export default function SurveyToolbar({
  blocks = [],
  selectedBlock,
  onSelectBlock,
  onSelectBlockRandomization,
  newBlockName,
  setNewBlockName,
  onAddBlock,
  onCopyLink,
  onNewQuestion,
  publicSurveyUrl,
  surveyTitle = "Survey",
  showBlocks = true,
  showCopy = true,
  showQR = true,
  showNewQuestion = true,
  rightSlot = null,
}) {
  const qrRef = useRef(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showRandomizationModal, setShowRandomizationModal] = useState(false);
  const [tempRandomization, setTempRandomization] = useState({
    type: "none",
    subsetCount: "",
  });

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    const canvas = await html2canvas(qrRef.current, {
      backgroundColor: null,
      useCORS: true,
    });
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${surveyTitle.replace(/\s+/g, "_").toLowerCase()}-qr.png`;
    link.click();
  };

  const selectedBlockData = blocks.find((b) => b.blockId === selectedBlock);

  const handleSaveRandomization = () => {
    if (!selectedBlock) return;
    const updatedBlocks = blocks.map((b) =>
      b.blockId === selectedBlock
        ? { ...b, randomization: { ...tempRandomization } }
        : b
    );
    onSelectBlockRandomization?.(selectedBlock, updatedBlocks);
    setShowRandomizationModal(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        {showBlocks && (
          <>
            {/* Block Selector */}
            <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-[#1A1A1E] dark:border-slate-700 p-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Block
              </span>
              <select
                id="blockSelect"
                value={selectedBlock || ""}
                onChange={(e) => onSelectBlock?.(e.target.value)}
                className="bg-transparent outline-none text-sm text-slate-700 capitalize dark:text-slate-200 pr-6"
              >
                <option value="" disabled>
                  Choose…
                </option>
                {blocks?.map((b) => (
                  <option key={b.blockId} value={b.blockId}>
                    {b.name}{" "}
                    {b.randomization?.type !== "none" ? "🔀" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Add Block */}
            <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-[#1A1A1E] dark:border-slate-700 px-2 py-1.5">
              <input
                type="text"
                placeholder="New block name"
                value={newBlockName}
                onChange={(e) => setNewBlockName?.(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" ? onAddBlock?.() : null
                }
                className="w-[160px] sm:w-[200px] bg-transparent outline-none text-sm placeholder:text-slate-400 dark:text-slate-200"
              />
              <button
                onClick={onAddBlock}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-2.5 py-1.5 transition-colors"
                title="Add Block"
              >
                <FiPlusSquare className="h-4 w-4" />
                Add
              </button>
            </div>

            {/* Randomization Button */}
            {selectedBlock && (
              <button
                onClick={() => {
                  const current = selectedBlockData?.randomization || {
                    type: "none",
                    subsetCount: "",
                  };
                  setTempRandomization(current);
                  setShowRandomizationModal(true);
                }}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md shadow transition-all duration-300 hover:scale-105"
              >
                <Settings size={14} />
                Randomization
              </button>
            )}
          </>
        )}

        {/* Right Side Buttons */}
        <div className="ml-auto flex items-center gap-2">
          {rightSlot}
          {showNewQuestion && (
            <button
              type="button"
              onClick={onNewQuestion}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 dark:bg-[#1A1A1E] transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl bg-[#ED7A13] text-white text-xs p-3"
              title="Create question"
            >
              <FiPlusSquare className="h-4 w-4" />
              New Question
            </button>
          )}
          {showCopy && (
            <button
              title="Copy survey link"
              onClick={onCopyLink}
              className="group relative p-3 rounded-lg transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl dark:bg-[#436F3A] bg-[#3BED1336] text-white flex items-center justify-center"
            >
              <IoCopyOutline className="w-5 h-5 text-[#427336] dark:text-[#4DC334]" />
            </button>
          )}
          {showQR && (
            <button
              title="Download QR code"
              onClick={() => setShowQRModal(true)}
              className="text-sm dark:bg-[#374247] bg-[#1159E833] text-white p-3 rounded-lg shadow hover:shadow-lg transition-all flex items-center gap-1"
            >
              <MdOutlineFileDownload className="h-5 w-5 dark:text-[#3482A6] text-[#213862]" />
            </button>
          )}
        </div>
      </div>

      {/* === Randomization Modal === */}
      {showRandomizationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1A1A1E] p-6 rounded-lg shadow-2xl w-[380px]">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Randomization Settings
            </h2>

            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="randType"
                  checked={tempRandomization.type === "none"}
                  onChange={() =>
                    setTempRandomization({ type: "none", subsetCount: "" })
                  }
                />
                No randomization
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="randType"
                  checked={tempRandomization.type === "full"}
                  onChange={() =>
                    setTempRandomization({ type: "full", subsetCount: "" })
                  }
                />
                Randomize all questions in this block
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="randType"
                  checked={tempRandomization.type === "subset"}
                  onChange={() =>
                    setTempRandomization({
                      type: "subset",
                      subsetCount: tempRandomization.subsetCount || 1,
                    })
                  }
                />
                Randomly present subset of questions
              </label>

              {tempRandomization.type === "subset" && (
                <input
                  type="number"
                  min="1"
                  value={tempRandomization.subsetCount}
                  onChange={(e) =>
                    setTempRandomization({
                      ...tempRandomization,
                      subsetCount: Number(e.target.value),
                    })
                  }
                  className="border p-2 w-full rounded-md dark:bg-[#222] dark:border-slate-700"
                  placeholder="Enter number of questions to show"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowRandomizationModal(false)}
                className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRandomization}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === QR Modal === */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-2xl w-[300px] text-center relative">
            <h2 className="text-lg font-bold mb-3 text-gray-800">
              {surveyTitle}
            </h2>
            <div
              ref={qrRef}
              className="bg-gray-100 p-4 rounded-xl flex flex-col items-center"
            >
              <QRCodeCanvas
                value={publicSurveyUrl || ""}
                size={180}
                bgColor="#ffffff"
              />
              <p className="mt-4 text-sm text-gray-700 italic">
                Powered by{" "}
                <span className="text-red-500 font-semibold">AppInfoLogic</span>
              </p>
              <img
                src="/appinfologiclogo.png"
                alt="AppInfoLogic Logo"
                className="h-20 mt-2"
              />
            </div>
            <div className="flex justify-between gap-3 mt-4">
              <button
                onClick={handleDownloadQR}
                className="w-full text-sm bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700"
              >
                Save QR
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full text-sm bg-gray-400 text-white px-4 py-2 rounded-md shadow hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
