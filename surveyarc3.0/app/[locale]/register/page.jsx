// pages/RegisterPage.jsx
"use client";

import React, { useState } from "react";
import {
  auth,
  createUserWithEmailAndPassword,
  googleAuthProvider,
  signInWithPopup,
} from "@/firebase/firebase";
import Link from "next/link";

export default function RegisterPage({ onNext, loading = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      console.log("Creating Firebase user...");
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log("Firebase user created:", userCredential.user.uid);

      // Prepare user data for PostgreSQL backend
      const userData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: name.trim(),
        role: "member", // Changed from "user" to "member"
        orgIds: [],
        status: "active",
        metaData: {}
      };

      console.log("Calling onNext with userData:", userData);

      // Pass to next step in registration flow
      await onNext(userData);
      
    } catch (err) {
      console.error("Registration error:", err);
      
      // Handle specific Firebase errors
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please sign in instead.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password is too weak. Please choose a stronger password.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsLoading(true);

    try {
      console.log("Starting Google sign-in...");
      const result = await signInWithPopup(auth, googleAuthProvider);
      const user = result.user;

      console.log("Google sign-in successful:", user.uid);

      // Prepare user data for PostgreSQL backend
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || "",
        role: "member", // Changed from "user" to "member"
        orgIds: [],
        status: "active",
        metaData: {}
      };

      console.log("Calling onNext with Google userData:", userData);

      // Pass to next step in registration flow
      await onNext(userData);
      
    } catch (err) {
      console.error("Google sign-in error:", err);
      
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in was cancelled. Please try again.");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Pop-up was blocked. Please allow pop-ups and try again.");
      } else {
        setError(err.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = loading || isLoading;

  return (
    <div className="min-h-screen bg-[#FFF7ED] dark:bg-[#1A1A1E] flex items-center justify-center p-4 relative">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl border border-white backdrop-blur-xl">
        {/* Video Section */}
        <div className="hidden md:flex items-center justify-center h-full">
          <video
            src="/video/Live online Form.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </div>

        {/* Form Section */}
        <div className="w-full p-8 md:p-12 bg-[#FFEEDF] dark:bg-[#1A1A1E]">
          <h2 className="text-3xl font-bold text-center mb-6 text-black dark:text-[#CBC9DE]">
            Create Account
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 dark:bg-red-200/10 dark:border-red-400 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {isDisabled && (
            <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg text-blue-700 dark:bg-blue-200/10 dark:border-blue-400 dark:text-blue-300">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Creating your account...</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block mb-1 text-sm text-black dark:text-[#CBC9DE]">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black placeholder-black dark:border-[#CBC9DE] dark:placeholder-[#CBC9DE] focus:outline-none focus:border-orange-400 transition-colors"
                placeholder="John Doe"
                required
                disabled={isDisabled}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm text-black dark:text-[#CBC9DE]">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black placeholder-black dark:border-[#CBC9DE] dark:placeholder-[#CBC9DE] focus:outline-none focus:border-orange-400 transition-colors"
                placeholder="you@example.com"
                required
                disabled={isDisabled}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm text-black dark:text-[#CBC9DE]">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black placeholder-black dark:border-[#CBC9DE] dark:placeholder-[#CBC9DE] focus:outline-none focus:border-orange-400 transition-colors"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={isDisabled}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              {isDisabled ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </div>
              ) : (
                "Create Account"
              )}
            </button>

            <div className="relative text-center text-sm text-gray-500 my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <span className="relative bg-[#FFEEDF] dark:bg-[#1A1A1E] px-2">or</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isDisabled}
              className="w-full py-3 rounded-xl border border-black dark:border-[#CBC9DE] text-black dark:text-[#CBC9DE] bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              {isDisabled ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Continue with Google"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-orange-600 hover:text-orange-500 transition-colors duration-300 font-semibold hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}