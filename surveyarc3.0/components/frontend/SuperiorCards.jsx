import Image from "next/image";
import React from "react";

const cardData = [
  {
    title: "Designed to attract",
    description:
      "Your forms will look anything but ordinary. Customize the entire design, embed it in all the right places, and strike a chord with engaging video content.",
    placeholder: "/Card1.png",
  },
  {
    title: "Gathers deeper insights",
    description:
      "More data is just a follow-up question away. Encourage customers to elaborate by asking questions based on their previous answers.",
    placeholder: "/Card2.png",
  },
  {
    title: "Prioritizes unique data",
    description:
      "Some data is harder to come by. Collect readily-available data without having to ask so your customers can focus on sharing everything else.",
    placeholder: "/Card3.png",
  },
];

export default function SuperiorCards() {
  return (
    <div className="w-full md:py-20 py-6 px-6 lg:px-28 bg-[#fff7ed] dark:bg-[#111827]">
      <div className="lg:w-[50%]  mx-auto text-center dark:text-[#fef3c7] text-[30px] lg:text-[64px] leading-none">
        With a superior form of data collection
      </div>
      <section className=" py-12 ">
        <div className=" grid grid-cols-1 md:grid-cols-3 gap-8">
          {cardData.map((card, index) => (
            <div key={index} className="">
              <div className="bg-gray-200 h-[400px] rounded-3xl mb-6 flex items-center justify-center">
                <Image
                  src={card.placeholder}
                  alt={card.title}
                  width={300}
                  height={300}
                  className=" w-full h-full object-cover object-bottom"
                />
              </div>
              <h3 className="text-[24px] dark:text-[#fcd34d] font-medium mb-2">
                {card.title}
              </h3>
              <p className="text-[16px] dark:text-[#fef3c7] text-gray-800">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
