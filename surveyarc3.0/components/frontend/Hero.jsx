"use client";

import React, { useState } from "react";
import Popup from "./Popup";

export default function Hero() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex  dark:bg-gray-900 flex-col lg:flex-row items-center justify-between md:min-h-screen h-[831px]  px-4 sm:px-8 md:px-16 lg:px-28 lg:py-10 gap-6 sm:gap-8 pb-20">
      {/* Content Section - Shows first on mobile, second on desktop */}
      <div className="w-full md:w-[656px] px-2 sm:px-4 order-1 lg:order-2 space-y-6 sm:space-y-8 flex flex-col items-center lg:items-start">
        <h1 className="text-[48px] text-center lg:text-start lg:text-[80px] w-[358px] lg:w-[656px] lg:h-[320px] h-[211px]  text-[#111827] dark:text-[#fef3c7] leading-tight lg:leading-none mb-4 sm:mb-6 mt-6 md:mt-0">
          Get to know your customers with forms worth filling out
        </h1>

        <p className="text-[16px] lg:text-[20px] h-[84px] text-center lg:text-start lg:h-[56px] w-full lg:w-[656px] text-[#6b7280] dark:text-[#fcd34d] mb-6 sm:mb-8 leading-relaxed">
          Collect all the data you need to{" "}
          <span className="font-semibold text-[#111827] dark:text-[#fb923c]">
            understand customers
          </span>{" "}
          with forms designed to be refreshingly different.
        </p>

        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#f97316] hover:bg-[#fb923c]  text-white font-medium px-8 sm:px-10 py-4 sm:py-5 rounded-xl text-base sm:text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
        >
          Get started—it's free
        </button>
      </div>
      <Popup isOpen={isOpen} onClose={() => setIsOpen(false)} />
      {/* Video Section - Shows second on mobile, first on desktop */}
      <div className="w-[358px] h-[358px] lg:w-1/2 relative aspect-video lg:aspect-auto lg:h-screen flex items-center justify-center overflow-hidden rounded-xl  order-2 lg:order-1  ">
        <video
          className="w-[358px] h-[358px] lg:w-[672px] lg:h-[672px] object-cover"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/video/Live online Form.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}
