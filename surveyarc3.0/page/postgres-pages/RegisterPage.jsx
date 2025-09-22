"use client";

import React, { useState } from "react";
import {
  auth,
  createUserWithEmailAndPassword,
  googleAuthProvider,
  signInWithPopup,
} from "@/firebase/firebase";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import Link from "next/link";

export default function RegisterPage({ onNext }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { createUser } = useUser();

  const createUserRecord = async (user, displayName) => {
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || "",
      role: "user",
      orgIds: [],
    };
    await createUser(userData);
    return userData;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name) {
      setError("Name is required");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const userData = await createUserRecord(userCredential.user, name);
      onNext(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const user = result.user;
      const userData = await createUserRecord(user, user.displayName);
      onNext(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


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
                className="w-full px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black placeholder-black dark:border-[#CBC9DE] dark:placeholder-[#CBC9DE] focus:outline-none "
                placeholder="you@example.com"
                required
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
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <div className="relative text-center text-sm text-[var(--text-secondary)] my-4">
              <span className="bg-[var(--surface)] px-2">or</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-black  dark:border-[#CBC9DE] text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Continue with Google"}
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
