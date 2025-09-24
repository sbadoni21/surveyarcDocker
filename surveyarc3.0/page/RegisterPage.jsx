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

    if (!name) {
      setError("Name is required");
      return;
    }

    setIsLoading(true);

    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Prepare user data for PostgreSQL backend
      const userData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: name,
        role: "member",
        orgIds: [],
        status: "active",
        metaData: {}
      };

      // Pass to next step
      await onNext(userData);
      
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const user = result.user;

      // Prepare user data for PostgreSQL backend
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || "",
        role: "member",
        orgIds: [],
        status: "active",
        metaData: {}
      };

      // Pass to next step
      await onNext(userData);
      
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = loading || isLoading;

  return (
    <div className="min-h-screen bg-[#FFF7ED] dark:bg-[#1A1A1E] flex items-center justify-center p-4 relative">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl border border-white backdrop-blur-xl">
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
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black placeholder-black dark:border-[#CBC9DE] dark:placeholder-[#CBC9DE] focus:outline-none"
                placeholder="John Doe"
                required
                disabled={isDisabled}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm text-black dark:text-[#CBC9DE]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black placeholder-black dark:border-[#CBC9DE] dark:placeholder-[#CBC9DE] focus:outline-none"
                placeholder="you@example.com"
                required
                disabled={isDisabled}
              />
            </div>

            <div>
              <label className="block mb-1 text-sm text-black dark:text-[#CBC9DE]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black placeholder-black dark:border-[#CBC9DE] dark:placeholder-[#CBC9DE] focus:outline-none"
                placeholder="••••••••"
                required
                disabled={isDisabled}
              />
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="w-full py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDisabled ? "Creating Account..." : "Create Account"}
            </button>

            <div className="relative text-center text-sm text-[var(--text-secondary)] my-4">
              <span className="bg-[var(--surface)] px-2">or</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isDisabled}
              className="w-full py-3 rounded-xl border border-black dark:border-[#CBC9DE] text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDisabled ? "Signing in..." : "Continue with Google"}
            </button>
          </form>

          <p className="mt-6 text-center text-[var(--text-secondary)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[var(--primary)] hover:underline font-semibold"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}