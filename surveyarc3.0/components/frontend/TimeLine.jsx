"use client";

import { useEffect, useRef, useState } from "react";

export default function StickyTimeline() {
  const containerRef = useRef(null);
  const [line1Height, setLine1Height] = useState(0);
  const [line2Height, setLine2Height] = useState(0);

  const maxHeight1 = 300;
  const maxHeight2 = 300;

  useEffect(() => {
    const handleScroll = () => {
      const section = containerRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();

      // Start animation when section reaches top of viewport
      if (rect.top <= 0 && rect.bottom >= 0) {
        const progress = Math.min(Math.abs(rect.top), maxHeight1 + maxHeight2);

        const h1 = Math.min(progress, maxHeight1);
        setLine1Height(h1);

        if (progress >= maxHeight1) {
          const h2 = Math.min(progress - maxHeight1, maxHeight2);
          setLine2Height(h2);
        } else {
          setLine2Height(0);
        }
      } else {
        setLine1Height(0);
        setLine2Height(0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative h-[120vh] bg-gray-100">
      {/* Sticky wrapper */}
      <div className="sticky top-0 h-screen flex items-center justify-center">
        {/* Timeline lines */}
        <div className="flex flex-col items-center">
          <div
            className="w-1 bg-blue-600 transition-all duration-75"
            style={{ height: `${line1Height}px` }}
          />
          <div className="h-2" />
          <div
            className="w-1 bg-green-600 transition-all duration-75"
            style={{ height: `${line2Height}px` }}
          />
        </div>

        {/* Optional content */}
        <div className="absolute top-10 left-10">
          <h2 className="text-xl font-bold">Timeline starts here</h2>
        </div>
      </div>
    </div>
  );
}
