"use client";
import { useRouter } from "next/navigation";
import React from "react";

const GoBackButton = () => {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition-all"
    >
      ← Go Back
    </button>
  );
};

export default GoBackButton;
