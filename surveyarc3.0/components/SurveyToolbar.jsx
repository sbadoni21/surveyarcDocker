"use client";
import React, { useRef, useState } from "react";
import { FiPlusSquare } from "react-icons/fi";
import { IoCopyOutline } from "react-icons/io5";
import { MdOutlineFileDownload } from "react-icons/md";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";

export default function SurveyToolbar({
  blocks = [],
  selectedBlock,
  onSelectBlock,
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

  return (
    <>
      <div className=" flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        {showBlocks && (
          <>
            <label className="sr-only" htmlFor="blockSelect">
              Select Block
            </label>
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
                  <option
                    key={b.blockId}
                    value={b.blockId}
                    className="capitalize"
                  >
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />

            <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-[#1A1A1E] dark:border-slate-700 px-2 py-1.5">
              <input
                type="text"
                placeholder="New block name"
                value={newBlockName}
                onChange={(e) => setNewBlockName?.(e.target.value)}
                onKeyDown={(e) => (e.key === "Enter" ? onAddBlock?.() : null)}
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
          </>
        )}

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
