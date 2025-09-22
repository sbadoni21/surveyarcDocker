'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@/providers/UserPProvider';
import { FaUserCircle } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

export default function UserCircle() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open]);

  if (!user) return null;

  const handleClick = (route) => {
    setOpen(false);
    if (route === 'feedback') {
      router.push('/org/feedback');
    }
    if (route === 'helpcenter') {
      router.push('/org/helpcenter');
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        className="text-3xl text-gray-700 hover:text-black focus:outline-none"
        onClick={() => setOpen(!open)}
      >
        <FaUserCircle />
      </button>

      <div
        className={`absolute left-full ml-2 mt-2 bg-white shadow-md rounded-lg z-50 transition-all duration-200 ease-out transform ${
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
        style={{ minWidth: '12rem' }}
      >
        <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
          {user.email}
        </div>
        <button
          onClick={() => handleClick('helpcenter')}
          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
        >
          Help Center
        </button>
        <button
          onClick={() => handleClick('feedback')}
          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
        >
          Feedback
        </button>
      </div>
    </div>
  );
}
