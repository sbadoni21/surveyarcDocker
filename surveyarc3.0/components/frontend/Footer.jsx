import Link from "next/link";
import React from "react";
import {
  FaFacebookF,
  FaXTwitter,
  FaInstagram,
  FaYoutube,
  FaLinkedinIn,
} from "react-icons/fa6";

export default function Footer() {
  const footerData = [
    {
      title: "Product",
      links: ["Pricing", "Enterprise"],
    },
    {
      title: "Templates",
      links: [
        "Popular templates",
        "Recent templates",
        "Popular categories",
        "Recent categories",
      ],
    },
    {
      title: "Integrations",
      links: [
        "Popular integration apps",
        "More integration apps",
        "Popular app categories",
        "More app categories",
      ],
    },
    {
      title: "Resources",
      links: [
        "Blog",
        "Help center",
        "Community",
        "Tutorials",
        "FAQs",
        "Why SurveyArc?",
        "Referral program",
        "Partners",
        "System status",
        "Developers / API",
      ],
    },
    {
      title: "Get to know us",
      links: [
        "About us",
        "Brand",
        "Careers",
        "Contact sales",
        "Terms and conditions",
        "SurveyArc (es)",
        "Newsletter",
      ],
      icons: true,
    },
  ];

  return (
    <div className="bg-[#111827] dark:bg-[#fff7ed]">
      <section className=" text-white dark:text-[#111827] py-16 px-6 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-6 leading-snug">
          Start getting to know your customers
        </h2>

        <div className="text-lg sm:text-xl mb-10 space-y-1">
          <p>Our Free Plan lets you:</p>
          <p>Create unlimited forms</p>
          <p>Access 3,000+ templates</p>
          <p>Start getting responses</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link href={"/register"}  className="bg-white text-[#111827] dark:bg-[#111827] dark:text-white font-semibold px-8 py-3 rounded-xl text-base">
            Sign up
          </Link>
          
        </div>
      </section>

      {/* <footer className=" text-white dark:text-[#111827] py-12 px-6 lg:px-28">
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-10">
          {footerData.map((section, index) => (
            <div key={index}>
              <h3 className="font-semibold uppercase text-sm mb-4 tracking-wide">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link, idx) => (
                  <li
                    key={idx}
                    className="hover:underline cursor-pointer transition-colors duration-200"
                  >
                    {link}
                  </li>
                ))}
              </ul>
              {section.icons && (
                <div className="flex space-x-4 mt-6">
                  <FaFacebookF className="hover:text-gray-300 cursor-pointer" />
                  <FaXTwitter className="hover:text-gray-300 cursor-pointer" />
                  <FaInstagram className="hover:text-gray-300 cursor-pointer" />
                  <FaYoutube className="hover:text-gray-300 cursor-pointer" />
                  <FaLinkedinIn className="hover:text-gray-300 cursor-pointer" />
                </div>
              )}
            </div>
          ))}
        </div>
      </footer>
      <div className="bg-[#111827] dark:bg-[#fff7ed] text-sm text-white dark:text-[#111827] border-t border-[#4a3b4e] py-4 px-6 lg:px-28">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌐</span>
            <span className="underline cursor-pointer">English</span>
            <span className="text-xs"></span>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-center">
            <span className="underline cursor-pointer">Cookie Settings</span>
            <span className="underline cursor-pointer">
              Check our cookies policy to delete cookies
            </span>
            <span className="underline cursor-pointer">Report abuse</span>
          </div>

          <div className="text-center sm:text-right">© SurveyArc</div>
        </div>
      </div> */}
    </div>
  );
}
