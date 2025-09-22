import Link from 'next/link';
import React from 'react';

export default function ThankYouPage() {
 

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center bg-gradient-to-br from-orange-50 to-yellow-100 text-gray-800">
  

      {/* Header */}
      <div >
        <div className="p-5 bg-orange-400 text-white rounded-full mb-6 shadow-lg">
        
        <h1 className="text-5xl font-light tracking-wide">Thank You</h1>
        </div>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Your responses have been successfully submitted. We appreciate your time and insights.
        </p>
      </div>

      {/* Simple Info Cards */}
      <div className="grid md:grid-cols-3 gap-4 w-full max-w-4xl mb-10">
        {[
          { icon: '✅', title: 'Survey Complete', desc: 'Your responses have been recorded successfully.' },
          { icon: '📊', title: 'Analysis Underway', desc: 'We are analyzing responses to make meaningful improvements.' },
          { icon: '📩', title: 'Stay Connected', desc: 'You may hear from us with updates or follow-up questions.' }
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-6">
            <div className="text-2xl mb-3">{item.icon}</div>
            <h3 className="text-lg font-medium mb-2 text-orange-500">{item.title}</h3>
            <p className="text-sm text-gray-600">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      {/* <Link href={"/"}
      
        className="mt-4 px-6 py-3 bg-orange-400 text-white rounded-full hover:bg-orange-500 transition"
      >
        Back to Homepage
      </Link> */}

      {/* Optional Quote */}
      <p className="mt-8 text-xs text-gray-400 tracking-wider uppercase">
        Your voice matters. Thank you for helping us grow.
      </p>
    </div>
  );
}
