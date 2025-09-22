import React from 'react';

export default function AnimatedDots() {
  return (
    <>
      {/* Top Left */}
      <div className="absolute top-2 left-4 w-1.5 h-1.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-ping opacity-60"></div>
      <div className="absolute top-10 left-10 w-1 h-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-bounce opacity-60"></div>

      {/* Top Right */}
      <div className="absolute top-4 right-8 w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse opacity-70"></div>
      <div className="absolute top-14 right-20 w-1.5 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-bounce opacity-50"></div>

      {/* Center Left */}
      <div className="absolute top-1/3 left-6 w-2 h-2 bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full animate-ping opacity-50"></div>
      <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-gradient-to-r from-pink-400 to-red-500 rounded-full animate-pulse opacity-70"></div>

      {/* Center Right */}
      <div className="absolute top-1/3 right-10 w-1.5 h-1.5 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full animate-ping opacity-50"></div>
      <div className="absolute top-1/2 right-[15%] w-2 h-2 bg-gradient-to-br from-teal-300 to-green-400 rounded-full animate-bounce opacity-60"></div>

      {/* Bottom Left */}
      <div className="absolute bottom-10 left-6 w-1.5 h-1.5 bg-gradient-to-r from-green-300 to-lime-400 rounded-full animate-ping opacity-70"></div>
      <div className="absolute bottom-20 left-20 w-2 h-2 bg-gradient-to-br from-pink-300 to-purple-500 rounded-full animate-bounce opacity-60"></div>

      {/* Bottom Right */}
      <div className="absolute bottom-12 right-12 w-1.5 h-1.5 bg-gradient-to-r from-orange-300 to-amber-500 rounded-full animate-pulse opacity-60"></div>
      <div className="absolute bottom-3 right-32 w-1 h-1 bg-gradient-to-br from-blue-300 to-indigo-400 rounded-full animate-ping opacity-50"></div>

      {/* Center */}
      <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-gradient-to-br from-rose-400 to-red-400 rounded-full animate-ping opacity-60"></div>
      <div className="absolute top-[60%] left-[55%] w-1.5 h-1.5 bg-gradient-to-br from-fuchsia-400 to-pink-500 rounded-full animate-bounce opacity-50"></div>
    </>
  );
}

