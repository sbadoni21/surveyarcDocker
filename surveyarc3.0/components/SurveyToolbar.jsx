"use client";
import React, { useRef, useState, useEffect } from "react";
import { FiPlusSquare } from "react-icons/fi";
import { IoCopyOutline } from "react-icons/io5";
import { MdOutlineFileDownload } from "react-icons/md";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";
import { Settings } from "lucide-react";

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

  const [storing, setStoring] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [addBlockValue, setAddBlockValue] = useState("");

  useEffect(() => {
    setAddBlockValue(newBlockName || "");
  }, [newBlockName]);

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

  const handleAddBlockFromModal = async () => {
    const name = (addBlockValue || "").trim();
    if (!name) return alert("Please enter block name");
    try {
      setStoring(true);
      await onAddBlock?.(name);
      setAddBlockValue("");
      setShowAddBlockModal(false);
      setStoring(false);
    } catch (error) {
      console.error("Error adding block: " + error.message);
      setStoring(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        {showBlocks &&
          ((blocks?.length || 0) === 0 ? (
            <div className="w-full flex items-center justify-between gap-4 p-4 rounded-lg border bg-white dark:bg-[#1A1A1E] dark:border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No blocks yet
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Create your first block to start adding questions
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddBlockModal(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                  title="Add Block"
                >
                  <FiPlusSquare className="h-4 w-4" />
                  Add Block
                </button>

                {showCopy && (
                  <button
                    title="Copy survey link"
                    onClick={onCopyLink}
                    className="group relative p-3 rounded-lg transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl dark:bg-[#436F3A] bg-[#3BED1336] text-white flex items-center justify-center"
                  >
                    <IoCopyOutline className="w-5 h-5 text-[#427336] dark:text-[#4DC334]" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border bg-white dark:bg-[#1A1A1E] dark:border-slate-700 p-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[48px]">
                  Current Block
                </span>

                <div className="flex items-center gap-3 min-w-0">
                  <select
                    id="blockSelect"
                    value={selectedBlock || ""}
                    onChange={(e) => onSelectBlock?.(e.target.value)}
                    className="bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 pr-6 truncate"
                    title={
                      selectedBlockData
                        ? `${selectedBlockData.name}`
                        : "Choose a block"
                    }
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {blocks?.map((b, idx) => (
                      <option key={b.blockId} value={b.blockId}>
                        {idx + 1}. {b.name}
                      </option>
                    ))}
                  </select>

                  {selectedBlock && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {(() => {
                        const idx = blocks?.findIndex(
                          (x) => x.blockId === selectedBlock
                        );
                        const pos = idx === -1 ? "—" : idx + 1;
                        const total = blocks?.length ?? 0;
                        return `${pos} of ${total}`;
                      })()}
                    </div>
                  )}

                  {selectedBlockData &&
                    selectedBlockData.randomization &&
                    selectedBlockData.randomization.type !== "none" &&
                    (() => {
                      const r = selectedBlockData.randomization;
                      const label =
                        r.type === "full"
                          ? "All"
                          : r.type === "subset"
                          ? r.subsetCount
                            ? `Subset (${r.subsetCount})`
                            : "Subset"
                          : "Randomized";
                      const toneClass =
                        r.type === "subset"
                          ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700"
                          : "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700";

                      return (
                        <div
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${toneClass}`}
                          title={
                            r.type === "subset"
                              ? `Randomize subset — show ${
                                  r.subsetCount ?? "N"
                                }`
                              : "Randomize all questions"
                          }
                        >
                          <svg
                            className="w-3 h-3"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                          >
                            <path
                              d="M4 7h4l3 6h3"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              opacity="0.9"
                            />
                            <path
                              d="M16 7v6"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              opacity="0.9"
                            />
                          </svg>
                          <span className="whitespace-nowrap">{label}</span>
                        </div>
                      );
                    })()}
                </div>
              </div>

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
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md shadow transition-all duration-200 hover:scale-105"
                  title="Open randomization settings for selected block"
                >
                  <Settings size={14} />
                  <span className="hidden sm:inline">Randomization</span>
                </button>
              )}

              <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddBlockModal(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-2 transition-colors"
                  title="Add Block"
                >
                  <FiPlusSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Block</span>
                </button>
              </div>
            </>
          ))}

        <div className="ml-auto flex items-center gap-2">
          {rightSlot}

          {showCopy && (
            <button
              title="Copy survey link"
              onClick={onCopyLink}
              className="group relative p-3 rounded-lg transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl dark:bg-[#436F3A] bg-[#3BED1336] text-white flex items-center justify-center"
            >
              <IoCopyOutline className="w-5 h-5 text-[#427336] dark:text-[#4DC334]" />
            </button>
          )}
        </div>
      </div>

      {showAddBlockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1A1A1E] p-6 rounded-lg shadow-2xl w-[380px]">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Add Block
            </h2>

            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="text"
                value={addBlockValue}
                onChange={(e) => setAddBlockValue(e.target.value)}
                className="w-full border p-2 rounded-md dark:bg-[#222] dark:border-slate-700"
                placeholder="Enter block name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddBlockFromModal();
                  if (e.key === "Escape") setShowAddBlockModal(false);
                }}
              />
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowAddBlockModal(false)}
                className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBlockFromModal}
                disabled={storing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
              >
                {storing ? "Adding..." : "Add Block"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onWheel={(e) => e.target.blur()}
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
