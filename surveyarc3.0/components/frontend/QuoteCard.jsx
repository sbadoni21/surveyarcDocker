"use client";
import Image from "next/image";
import React, { useState } from "react";
import Popup from "./Popup";

export default function TestSection() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-[#fff7ed] dark:bg-gray-900 px-4 sm:px-8 md:px-12 lg:px-24 pb-12 md:pb-0">
      <section className="bg-pink-200 relative overflow-hidden p-6 sm:p-12 md:p-20 lg:p-28 rounded-[30px] sm:rounded-[40px] md:rounded-[50px] lg:rounded-[60px] flex flex-col lg:flex-row items-center justify-between md:min-h-screen">
        <div className="hidden lg:block absolute top-0 right-24 w-[400px] h-auto z-0">
          <Image
            src="/toside.png"
            alt="Top Coral Shape"
            width={350}
            height={200}
            className="object-contain w-full h-auto"
          />
        </div>

        <div className="hidden lg:flex absolute w-24 h-24 right-36 rounded-[40px] items-center justify-center">
          <Image
            src="/video/SURVEYARC LOGO-gif.gif"
            alt="SurveyArc Logo"
            width={1000}
            height={1000}
            className="w-full h-full  rounded-[20px] "
          />
        </div>

        <div className="hidden lg:flex absolute w-28 h-28 right-96 rounded-[40px] items-center justify-center">
          <Image
            src="/clam.png"
            alt="SurveyArc Logo"
            width={1000}
            height={1000}
            className="w-full h-full"
          />
        </div>

        <div className="hidden lg:block absolute bottom-0 right-24 w-[400px] h-auto z-0">
          <Image
            src="/downimage.png"
            alt="Bottom Coral Shape"
            width={350}
            height={200}
            className="object-contain w-full h-auto"
          />
        </div>

        <div className="relative lg:absolute lg:left-15 w-full lg:h-[593px] lg:w-[656px] lg:grid lg:grid-cols-12 lg:gap-10 z-10 flex flex-col items-center justify-center lg:justify-start">
          <div className="w-full max-w-[656px] lg:h-[433px] lg:w-[656px] text-center lg:text-left px-4 sm:px-8 lg:px-0">
            <h2 className="text-[#111827] text-2xl sm:text-3xl md:text-4xl lg:text-[64px] leading-tight lg:leading-none lg:h-[281px] lg:w-[656px] mb-4 lg:mb-0">
              "We need to know that we're building the right things for real
              problems."
            </h2>
            <p className="text-base sm:text-lg text-[#6b7280] lg:h-[56px] lg:w-[656px] mb-6 lg:mb-0">
              Chase Clark, Senior UX Researcher at Calm, explains why they
              switched to SurveyArc.
            </p>

            <button
              onClick={() => setIsOpen(true)}
              className="hidden lg:block bg-[#f97316] hover:bg-[#fb923c] text-white w-[140px] sm:w-[160px] h-[44px] sm:h-[48px] font-medium mt-4 lg:mt-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Read on
            </button>
          </div>
          <Popup isOpen={isOpen} onClose={() => setIsOpen(false)} />

          <div className="lg:hidden w-full flex flex-col items-center mt-8 space-y-6">
            <div className="relative w-full max-w-sm">
              <div className="w-full flex justify-center mb-4">
                <Image
                  src="/toside.png"
                  alt="Top Coral Shape"
                  width={200}
                  height={120}
                  className="object-contain"
                />
              </div>

              <div className="flex justify-center space-x-8 mb-4">
                <div className="w-20 h-20  bg-white rounded-[20px] sm:rounded-[30px] shadow-md flex items-center justify-center">
                  <Image
                    src="/clam.png"
                    alt="Calm Logo"
                    width={40}
                    height={40}
                    className="w-16 h-16 sm:w-8 sm:h-8"
                  />
                </div>
                <div className="w-20 h-20  bg-white rounded-[20px] sm:rounded-[30px] shadow-md flex items-center justify-center">
                  <div className="bg-orange-500 dark:bg-orange-400 rounded-lg w-8 h-8 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
                    <div className="w-3 h-3 rounded-sm bg-orange-50 "></div>
                  </div>
                </div>
              </div>

              <div className="w-full flex justify-center">
                <Image
                  src="/downimage.png"
                  alt="Bottom Coral Shape"
                  width={200}
                  height={120}
                  className="object-contain"
                />
              </div>
            </div>

            <button
              onClick={() => setIsOpen(true)}
              className="bg-[#f97316] hover:bg-[#fb923c] text-white w-[140px] sm:w-[160px] h-[44px] sm:h-[48px] font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Read on
            </button>
          </div>
          <Popup isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
      </section>
    </div>
  );
}
