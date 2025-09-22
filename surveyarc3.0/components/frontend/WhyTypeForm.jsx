import React from "react";

const stats = [
  {
    value: "96%",
    description: "of customers say they have a better brand experience",
  },
  {
    value: "95%",
    description: "of customers say they gather more data, more easily",
  },
  {
    value: "87%",
    description: "of customers say they reveal deeper insights from data",
  },
];

export default function WhySurveyArc() {
  return (
    <div className="bg-[#111827] dark:bg-[#fff7ed]">
      <section className="bg-[#fff7ed] dark:bg-[#111827] rounded-b-[60px] md:rounded-b-[100px] py-12 px-6 md:py-20 md:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-[64px] font-medium mb-4 dark:text-[#fef3c7] text-[#111827] leading-tight">
            Why SurveyArc?
          </h2>
          <p className="text-base md:text-[20px] text-gray-800 dark:text-[#fef3c7] mb-12 md:mb-16">
            Because after switching to us…
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="flex flex-col justify-center items-center text-center"
              >
                <div className="text-5xl md:text-[80px] dark:text-[#fcd34d] text-[#111827] font-medium">
                  {stat.value}
                </div>
                <p className="text-base md:text-[20px] text-gray-700 dark:text-[#fef3c7] max-w-[250px] mt-2">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
