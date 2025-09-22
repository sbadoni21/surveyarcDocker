"use client";
import React, { useRef, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { FileCopyOutlined, Download } from "@mui/icons-material";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";
import { IoCopyOutline } from "react-icons/io5";
import { MdOutlineFileDownload } from "react-icons/md";

export default function QuestionActions({
  setShowTypePopup,
  handleCopyLink,
  publicSurveyUrl,
  surveyTitle = "Survey",
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
    <div className="flex gap-4 items-center bg-white dark:bg-[#1A1A1E] p-2 rounded-lg w-fit">
      <button
        onClick={() => setShowTypePopup(true)}
        className="group relative py-3 px-6 w-fit rounded-lg font-semibold transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl bg-[#ED7A13] text-white flex items-center justify-center gap-2"
      >
        <FaPlus className="w-4 h-4" />
        <span className="relative text-sm font-normal">New Question</span>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </button>
      <button
        title="Copy Survey link"
        onClick={handleCopyLink}
        className="group relative p-3 rounded-lg transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl dark:bg-[#436F3A] bg-[#3BED1336] text-white flex items-center justify-center"
      >
        <IoCopyOutline size={240} className="w-5 h-5 text-[#427336] dark:text-[#4DC334]" />
      </button>
      <button
        title="Download QR code"
        onClick={() => setShowQRModal(true)}
        className="text-sm dark:bg-[#374247] bg-[#1159E833] text-white px-4 py-2 rounded-lg shadow hover:shadow-lg transition-all flex items-center gap-1"
      >
        <MdOutlineFileDownload
          size={24}
          className="h-6 w-6 dark:text-[#3482A6] text-[#213862]"
          fontSize="small"
        />
      </button>

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
                value={publicSurveyUrl}
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
    </div>
  );
}
