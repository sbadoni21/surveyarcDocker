import React from "react";
import Marquee from "react-fast-marquee";

const logos = [
  { src: "/logo/hubspot.svg", alt: "hubspot" },
  { src: "/logo/hermes.svg", alt: "hermes" },
  { src: "/logo/loloccitane.svg", alt: "loloccitane" },
  { src: "/logo/caldendly.svg", alt: "caldendly" },
  { src: "/logo/slack.svg", alt: "slack" },
  { src: "/logo/webflow.svg", alt: "Webflow" },
  { src: "/logo/zapier.svg", alt: "Zapier" },
  { src: "/logo/wetransfer.svg", alt: "wetransfer" },
  { src: "/logo/caldendly.svg", alt: "Calendly" },
];

export default function BrandMarquee() {
  return (
    <section className="py-12 px-4 bg-[#fff7ed] dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="lg:max-w-[90%] max-w-[95%] py-16 rounded-[50px] bg-white mx-auto text-center">
        <div className="flex flex-col">
          <p className="uppercase text-sm tracking-wide text-[#111827]">
            Integrations
          </p>
          <h2 className="text-[30px] md:text-[48px] my-6 leading-none lg:w-[50%] dark:text-[#fcd34d] mx-auto mb-8">
            Connect with hundreds of your mission-critical tools
          </h2>
        </div>

        <div className="flex flex-col lg:space-y-6 space-y-4">
          <Marquee gradient={false} speed={40} pauseOnHover>
            {logos.map((logo, index) => (
              <div
                key={index}
                className="mx-4 my-2 p-4 rounded-3xl bg-gray-100 dark:bg-[#fef3c7] hover:bg-gray-200 dark:hover:bg-gray-700 transition duration-300 hover:rounded-[30px]  flex items-center justify-center"
                style={{ minWidth: "150px", height: "80px" }}
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  className="h-8 object-contain"
                />
              </div>
            ))}
          </Marquee>

          <Marquee gradient={false} speed={40} pauseOnHover direction="right">
            {logos.map((logo, index) => (
              <div
                key={index}
                className="mx-4 my-2 p-4 rounded-3xl bg-gray-100 dark:bg-[#fef3c7] hover:bg-gray-200 dark:hover:bg-gray-700 transition duration-300 hover:rounded-[30px] flex items-center justify-center"
                style={{ minWidth: "150px", height: "80px" }}
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  className="h-8 object-contain"
                />
              </div>
            ))}
          </Marquee>
        </div>

        <button className="mt-6 px-6 lg:w-fit w-[90%] py-3 rounded-lg dark:bg-[#fef3c7] dark:text-[#111827] bg-[#111827] text-white font-medium">
          View all 300+ integrations
        </button>
      </div>
    </section>
  );
}
