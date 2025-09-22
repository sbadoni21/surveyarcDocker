"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const logos = [
  { src: "/logo/barry.svg", alt: "barry" },
  { src: "/logo/caldendly.svg", alt: "caldendly" },
  { src: "/logo/wetransfer.svg", alt: "wetransfer" },
  { src: "/logo/hermes.svg", alt: "hermes" },
  { src: "/logo/hubspot.svg", alt: "hubspot" },
  { src: "/logo/loloccitane.svg", alt: "loloccitane" },
];

// Shuffle helper
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function LogoWaveSwap() {
  const [shuffledLogos, setShuffledLogos] = useState(logos);
  const [animateKey, setAnimateKey] = useState(0);
  const [triggerSecondGroup, setTriggerSecondGroup] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const newShuffle = shuffleArray(logos);
      setShuffledLogos(newShuffle);
      setAnimateKey((prev) => prev + 1);
      setTriggerSecondGroup(false);

      setTimeout(() => setTriggerSecondGroup(true), 1000);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const firstGroup = shuffledLogos.slice(0, 3);
  const secondGroup = shuffledLogos.slice(3);

  return (
    <div className="flex justify-center bg-[#fff7ed] dark:bg-gray-900  py-10">
      <div className="lg:flex grid grid-cols-2 gap-6 lg:flex-wrap justify-center">
        {firstGroup.map((logo, index) => (
          <motion.div
            key={`${logo.alt}-${animateKey}-first`}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              delay: index * 0.2,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
            className="lg:w-48 w-40 h-24 bg-white rounded-2xl shadow-md flex items-center justify-center"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              width={120}
              height={40}
              className="object-contain"
            />
          </motion.div>
        ))}

        {secondGroup.map((logo, index) => (
          <motion.div
            key={`${logo.alt}-${animateKey}-second`}
            initial={{ y: -20, opacity: 0 }}
            animate={triggerSecondGroup ? { y: 0, opacity: 1 } : {}}
            transition={{
              delay: index * 0.2,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
            className="lg:w-48 w-40 h-24 bg-white rounded-2xl shadow-md flex items-center justify-center"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              width={120}
              height={40}
              className="object-contain"
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
