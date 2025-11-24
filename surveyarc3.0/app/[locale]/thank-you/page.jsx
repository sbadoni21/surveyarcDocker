import Link from "next/link";
import React from "react";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center 
      bg-gradient-to-br from-orange-50 via-white to-yellow-100 text-gray-800">

      {/* Animated Badge */}
      <div className="mb-8">
        <div className="p-6 bg-orange-500 text-white rounded-full shadow-xl animate-pulse">
          <h1 className="text-4xl md:text-5xl font-bold tracking-wide drop-shadow">
            Thank You!
          </h1>
        </div>

        <p className="text-base md:text-lg text-gray-700 mt-6 max-w-xl mx-auto leading-relaxed">
          Your responses have been submitted successfully.  
          We truly appreciate your time and valuable insights.
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-6 w-full max-w-5xl mt-6 mb-10 px-2">
        {[
          { icon: "🎉", title: "Survey Complete", desc: "Your valuable feedback has been recorded." },
          { icon: "📊", title: "Analysis in Progress", desc: "We’re reviewing your input to improve our services." },
          { icon: "🤝", title: "Stay Connected", desc: "We may reach out with updates or follow-up questions." }
        ].map((item, idx) => (
          <div 
            key={idx} 
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg hover:scale-[1.02] transition 
                border border-orange-100"
          >
            <div className="text-4xl mb-4">{item.icon}</div>
            <h3 className="text-xl font-semibold text-orange-600 mb-2">{item.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <Link
        href="/"
        className="px-6 py-3 bg-orange-500 text-white rounded-full shadow hover:bg-orange-600 
        transition font-medium tracking-wide"
      >
        Back to Home
      </Link>

      {/* Footer Line */}
      <p className="mt-10 text-xs text-gray-500 tracking-wider uppercase">
        Your voice shapes our future — thank you.
      </p>
    </div>
  );
}
