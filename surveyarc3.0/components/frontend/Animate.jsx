"use client";

import { useRouter } from "next/navigation";
import React from "react";

export default function Heropage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#fff7ed] dark:bg-gray-900 px-4 sm:px-8 md:px-16 lg:px-24 py-8 sm:py-12 md:py-16 lg:py-20">
      <p className="text-center text-[36px] lg:text-[64px]  text-[#111827] dark:text-[#fef3c7]  leading-none mb-8 sm:mb-12 md:mb-16 lg:mb-20">
        SurveyArc helps you
        <br className="hidden sm:block" /> understand customers
      </p>

      <div className="block lg:hidden space-y-4 md:space-y-12">
        <div className="text-center">
          <span className="text-xs sm:text-sm font-medium text-purple-600 tracking-wide uppercase">
            FORMS, SURVEYS, AND QUIZZES
          </span>
        </div>

        <p className="text-center text-[30px] md:text-4xl text-[#111827] dark:text-[#fef3c7] leading-none mb-4 ">
          Get up to 3.5x more data about them
        </p>

        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="w-[358px] h-[358px] relative aspect-square flex items-center justify-center overflow-hidden border border-gray-200 rounded-xl shadow-lg">
            <video
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/video/video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>

        <p className="text-center text-[16px] text-[#6b7280] dark:text-[#fcd34d] mb-6 sm:mb-8 leading-relaxed px-4">
          When your forms break the norm, more people fill them out. Think
          branded designs, video content, and relevant follow-up questions.
        </p>

        <div className="text-center pb-16">
          <button
            onClick={() => router.push("/register")}
            className="bg-[#f97316] hover:bg-[#fb923c] text-white w-[140px] sm:w-[160px] h-[44px] sm:h-[48px] font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
          >
            Sign up
          </button>
        </div>

        <div className="text-center ">
          <span className="text-xs sm:text-sm font-medium text-purple-600 tracking-wide uppercase">
            Customer Intelligence
          </span>
        </div>

        <p className="text-center text-[30px] text-[#111827] dark:text-[#fef3c7] leading-tight mb-4 sm:mb-6">
          Use that data to guide your next move
        </p>

        <div className="flex justify-center mb-6 sm:mb-8">
          <div className=" w-[358px] h-[358px] relative aspect-square flex items-center justify-center overflow-hidden border border-gray-200 rounded-xl shadow-lg">
            <video
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/video/Live online Form3.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>

        <p className="text-center text-[16px] text-[#6b7280] dark:text-[#fcd34d] mb-6 sm:mb-8 leading-relaxed px-4">
          What led customers to you. Their opinions. How they decide what to
          buy. Data can tell you a lot and our AI analysis can help you make
          sense of it all.
        </p>

        <div className="text-center pb-16">
          <button
            onClick={() => router.push("/register")}
            className="bg-[#f97316] hover:bg-[#fb923c] text-white w-[140px] sm:w-[160px] h-[44px] sm:h-[48px] font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
          >
            Sign up
          </button>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="flex flex-col lg:flex-row items-center justify-evenly h-[551px] py-10">
          <div className="w-[456px] px-4 h-[333px] flex flex-col justify-center">
            <div className="mb-4">
              <span className="text-sm font-medium text-purple-600 tracking-wide uppercase">
                FORMS, SURVEYS, AND QUIZZES
              </span>
            </div>

            <p className="text-[48px]   text-[#111827] dark:text-[#fef3c7] leading-none mb-6">
              Get up to 3.5x more data about them
            </p>

            <p className="text-[20px]   text-[#6b7280] dark:text-[#fcd34d] mb-8 leading-relaxed">
              When your forms break the norm, more people fill them out. Think
              branded designs, video content, and relevant follow-up questions.
            </p>

            <button
              onClick={() => router.push("/register")}
              className="bg-[#f97316] hover:bg-[#fb923c] text-white px-12 py-2 w-fit font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 "
            >
              Sign up
            </button>
          </div>

          <div className="w-[541px] h-[541px] relative flex items-center justify-center overflow-hidden border border-gray-200 rounded-xl shadow-lg">
            <video
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/video/video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-evenly h-[551px] py-10 my-14">
          <div className="w-[541px] h-[541px] relative aspect-video flex items-center justify-center overflow-hidden border border-gray-200 rounded-xl shadow-lg">
            <video
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src="/video/Live online Form3.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="w-[456px] px-4 h-[413px] flex flex-col justify-center">
            <div className="mb-4">
              <span className="text-sm font-medium text-purple-600 tracking-wide uppercase">
                Customer Intelligence
              </span>
            </div>

            <p className="text-[48px]  text-[#111827] dark:text-[#fef3c7] leading-none mb-6">
              Use that data to guide your next move
            </p>

            <p className="text-[20px] text-[#6b7280] dark:text-[#fcd34d] mb-8 leading-relaxed">
              What led customers to you. Their opinions. How they decide what to
              buy. Data can tell you a lot and our AI analysis can help you make
              sense of it all.
            </p>

            <button
              onClick={() => router.push("/register")}
              className="bg-[#f97316] hover:bg-[#fb923c] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 w-fit px-12 py-2 "
            >
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
