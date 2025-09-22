"use client";
import React, { useState } from "react";
import { ChevronDown, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";

const productsLinks = [
  "Product A",
  "Product B",
  "Product C",
  "Product D",
  "Product E",
  "Product F",
];

const resourcesLinks = [
  "Blog",
  "Help Center",
  "Guides",
  "Webinars",
  "Templates",
  "Tutorials",
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showMobileDropdown, setShowMobileDropdown] = useState("");
  const [isDark, setIsDark] = useState(false);
  const router = useRouter();
   const handleClick = (value) => {
    if (value === "login") {
      router.push("/login");
    }
    if (value === "register") {
      router.push("/register");
    }
  };
  const toggleMobileDropdown = (menu) => {
    setShowMobileDropdown(showMobileDropdown === menu ? "" : menu);
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <div className={isDark ? "dark" : ""}>
      <nav className="relative z-50 bg-[#fff7ed] dark:bg-gray-900 border-b-2 border-yellow-300 dark:border-orange-500 shadow-lg transition-all duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 xl:px-28">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center">
              <div className="font-bold text-xl flex items-center space-x-2 group">
                <div className="group w-12 h-12 flex items-center justify-center  overflow-hidden">
                  <img
                    src="/video/SURVEYARC LOGO-gif.gif"
                    alt="Animated Icon"
                    className="w-16 h-16 object-contain transition-transform duration-300 transform group-hover:scale-110 group-hover:rotate-12"
                  />
                </div>

                <span className="text-gray-900 dark:text-yellow-100">
                  SurveyArc
                </span>
              </div>
            </div>

            {/* Desktop Menu */}
    

            {/* Right - Auth Buttons & Theme Toggle */}
            <div className="hidden lg:flex items-center space-x-4">
              <button
onClick={() => handleClick("login")}
                href="#"
                className="text-sm text-gray-900 dark:text-yellow-100 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-100 dark:hover:bg-gray-800 transition-all duration-300 py-2 px-4 rounded-lg"
              >
                Log in
              </button>
              <button
onClick={() => handleClick("register")}
                className="text-sm px-6 py-2 rounded-full bg-orange-500 dark:bg-orange-400 text-orange-50 dark:text-gray-900 hover:bg-orange-400 dark:hover:bg-orange-300 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Sign up
              </button>
            </div>

            {/* Mobile Hamburger & Theme Toggle */}
            <div className="lg:hidden flex items-center space-x-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-orange-100 dark:bg-gray-800 text-gray-900 dark:text-yellow-100 transition-all duration-300"
              >
                {isDark ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg text-gray-900 dark:text-yellow-100 hover:bg-orange-100 dark:hover:bg-gray-800 transition-colors duration-300"
              >
                <div className="relative w-6 h-6">
                  <span
                    className={`absolute block h-0.5 w-6 bg-gray-900 dark:bg-yellow-100 transform transition-all duration-300 ease-in-out ${
                      isOpen ? "rotate-45 translate-y-2.5" : "translate-y-0"
                    }`}
                  />
                  <span
                    className={`absolute block h-0.5 w-6 bg-gray-900 dark:bg-yellow-100 transform transition-all duration-300 ease-in-out ${
                      isOpen ? "opacity-0" : "translate-y-2"
                    }`}
                  />
                  <span
                    className={`absolute block h-0.5 w-6 bg-gray-900 dark:bg-yellow-100 transform transition-all duration-300 ease-in-out ${
                      isOpen ? "-rotate-45 translate-y-2.5" : "translate-y-4"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden bg-orange-100 dark:bg-gray-800 border-t border-yellow-300 dark:border-orange-500 shadow-lg transition-all duration-500 ease-out overflow-hidden ${
            isOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-4 py-6 space-y-4">
            {/* Mobile Products */}
            <div className="space-y-2">
              <button
                onClick={() => toggleMobileDropdown("products")}
                className="flex items-center justify-between w-full text-left text-gray-900 dark:text-yellow-100 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-100 transition-colors duration-300 py-2 px-3 rounded-lg"
              >
                <span className="font-medium">Products</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ${
                    showMobileDropdown === "products" ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`transition-all duration-300 ease-out overflow-hidden ${
                  showMobileDropdown === "products"
                    ? "max-h-96 opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="pl-4 space-y-2">
                  {productsLinks.map((item, index) => (
                    <a
                      key={index}
                      href="#"
                      className="block text-sm text-gray-600 dark:text-yellow-300 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-100 transition-colors duration-300 py-2 px-3 rounded-lg"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Resources */}
            <div className="space-y-2">
              <button
                onClick={() => toggleMobileDropdown("resources")}
                className="flex items-center justify-between w-full text-left text-gray-900 dark:text-yellow-100 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-100 transition-colors duration-300 py-2 px-3 rounded-lg"
              >
                <span className="font-medium">Resources</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ${
                    showMobileDropdown === "resources" ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`transition-all duration-300 ease-out overflow-hidden ${
                  showMobileDropdown === "resources"
                    ? "max-h-96 opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="pl-4 space-y-2">
                  {resourcesLinks.map((item, index) => (
                    <a
                      key={index}
                      href="#"
                      className="block text-sm text-gray-600 dark:text-yellow-300 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-100 transition-colors duration-300 py-2 px-3 rounded-lg"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <a
              href="#"
              className="block text-gray-900 dark:text-yellow-100 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-100 transition-colors duration-300 py-2 px-3 rounded-lg font-medium"
            >
              Enterprise
            </a>
            <a
              href="#"
              className="block text-gray-900 dark:text-yellow-100 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-100 transition-colors duration-300 py-2 px-3 rounded-lg font-medium"
            >
              Pricing
            </a>

            <div className="pt-4 space-y-3 border-t border-yellow-300 dark:border-orange-500">
              <a
                href="#"
                className="block text-gray-900 dark:text-yellow-100 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-100 transition-colors duration-300 py-2 px-3 rounded-lg"
              >
                Log in
              </a>
              <a
                href="#"
                className="block px-6 py-3 rounded-full text-center bg-orange-500 dark:bg-orange-400 text-orange-50 dark:text-gray-900 hover:bg-orange-400 dark:hover:bg-orange-300 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Sign up
              </a>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
