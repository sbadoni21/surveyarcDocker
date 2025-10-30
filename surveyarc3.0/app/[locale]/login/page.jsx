"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "@/firebase/firebase";
import { GoogleAuthProvider } from "firebase/auth";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { FaChrome } from "react-icons/fa";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { setCookie } from "cookies-next";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState("");
  const router = useRouter();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showPassword, setShowPassword] = useState(false);
const { setCurrentUser, getUser, loginUser } = useUser();
  const { setCurrentOrg, getById } = useOrganisation();

const fetchUserAndOrg = async (uid, firebaseUser = null) => {
  try {
    
    let user = await getUser(uid);

    if (!user) {
      throw new Error("User not found and could not be created");
    }
    
    setCurrentUser(user);
    
    // Track login in backend
    try {
      await loginUser(uid);
      console.log("Login tracked successfully");
    } catch (loginError) {
      console.error("Failed to track login:", loginError);
      // Don't fail the entire login process for tracking failure
    }
    
    // Handle organization logic
    const primaryOrgId = Array.isArray(user.org_ids) && user.org_ids.length > 0
      ? String(user.org_ids[0])
      : (user.org_ids ? String(user.org_ids) : null);
    
    if (!primaryOrgId) {
      setCookie("currentUserId", user.uid);
        throw new Error("You dont have any organisation");
    }
    
    try {
      const org = await getById(primaryOrgId);
      
      if (!org) {
        throw new Error("Organization not found");
      }
      
      setCurrentOrg(org);
      setCookie("currentUserId", user.uid);
      setCookie("currentOrgId", primaryOrgId);
      
      router.push(`/postgres-org/${primaryOrgId}/dashboard`);
      
    } catch (orgError) {
      console.error("Failed to fetch organization:", orgError);
      // Redirect to org selection if their org is invalid
      setCookie("currentUserId", user.uid);
      router.push("/select-organization");
    }
    
  } catch (err) {
    console.error("fetchUserAndOrg failed:", err);
    setError(err.message || "Failed to sign in");
    setLoading(false);
  }
};


  const handleEmailLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await fetchUserAndOrg(userCred.user.uid);
    } catch (err) {
      setError(err.message || "Email login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      await fetchUserAndOrg(userCred.user.uid);
    } catch (err) {
      setError(err.message || "Google login failed");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute w-96 h-96 bg-gradient-to-br from-orange-300/30 to-amber-300/30 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${
              mousePosition.y * 0.02
            }px)`,
            top: "10%",
            left: "15%",
            animationDuration: "4s",
          }}
        />
        <div
          className="absolute w-80 h-80 bg-gradient-to-br from-yellow-300/40 to-orange-300/40 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"
          style={{
            transform: `translate(${mousePosition.x * -0.01}px, ${
              mousePosition.y * -0.01
            }px)`,
            bottom: "15%",
            right: "20%",
            animationDelay: "2s",
            animationDuration: "3s",
          }}
        />
        <div
          className="absolute w-64 h-64 bg-gradient-to-br from-amber-400/20 to-yellow-400/20 rounded-full mix-blend-multiply filter blur-2xl animate-pulse"
          style={{
            transform: `translate(${mousePosition.x * 0.015}px, ${
              mousePosition.y * 0.015
            }px)`,
            top: "60%",
            left: "10%",
            animationDelay: "1s",
            animationDuration: "5s",
          }}
        />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {[
          { left: 10, top: 20, delay: 0, duration: 8, rotation: 45 },
          { left: 85, top: 15, delay: 1, duration: 10, rotation: 120 },
          { left: 30, top: 70, delay: 2, duration: 9, rotation: 270 },
          { left: 70, top: 50, delay: 1.5, duration: 11, rotation: 180 },
          { left: 15, top: 80, delay: 3, duration: 8.5, rotation: 90 },
          { left: 90, top: 25, delay: 0.5, duration: 9.5, rotation: 315 },
          { left: 50, top: 10, delay: 2.5, duration: 10.5, rotation: 60 },
          { left: 25, top: 45, delay: 4, duration: 8.8, rotation: 200 },
          { left: 75, top: 75, delay: 1.8, duration: 9.2, rotation: 135 },
          { left: 5, top: 60, delay: 3.2, duration: 10.8, rotation: 300 },
          { left: 95, top: 35, delay: 0.8, duration: 9.8, rotation: 75 },
          { left: 40, top: 85, delay: 2.8, duration: 8.3, rotation: 225 },
          { left: 60, top: 5, delay: 1.2, duration: 11.2, rotation: 150 },
          { left: 80, top: 65, delay: 3.5, duration: 9.7, rotation: 30 },
          { left: 35, top: 30, delay: 4.2, duration: 10.3, rotation: 255 },
        ].map((shape, i) => (
          <div
            key={i}
            className="absolute opacity-10 animate-float"
            style={{
              left: `${shape.left}%`,
              top: `${shape.top}%`,
              animationDelay: `${shape.delay}s`,
              animationDuration: `${shape.duration}s`,
              transform: `rotate(${shape.rotation}deg)`,
            }}
          >
            {i % 3 === 0 ? (
              <div className="w-4 h-4 bg-orange-300/20 rotate-45" />
            ) : i % 3 === 1 ? (
              <div className="w-3 h-3 bg-amber-300/20 rounded-full" />
            ) : (
              <div className="w-5 h-1 bg-yellow-300/20 rounded-full" />
            )}
          </div>
        ))}
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/video/Live online Form.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-200/20 to-amber-200/20 rounded-3xl blur-xl transform rotate-1 scale-105" />

          <div className="relative backdrop-blur-xl bg-white/40 border border-orange-200/30 rounded-3xl p-8 shadow-2xl hover:shadow-orange-200/20 transition-all duration-700 transform hover:scale-[1.02] hover:-translate-y-1">
            <div className="absolute -top-2 -left-2 w-6 h-6 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full animate-pulse opacity-60" />
            <div
              className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full animate-pulse opacity-40"
              style={{ animationDelay: "1s" }}
            />
            <div
              className="absolute -bottom-2 -left-2 w-4 h-4 bg-gradient-to-br from-amber-400 to-yellow-400 rounded-full animate-pulse opacity-50"
              style={{ animationDelay: "2s" }}
            />

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-4 shadow-lg hover:shadow-orange-400/50 transition-all duration-500 transform hover:rotate-12 hover:scale-110 group">
                <Sparkles className="w-8 h-8 text-white group-hover:animate-spin transition-transform duration-500" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 via-orange-600 to-amber-600 bg-clip-text text-transparent mb-2 animate-fade-in">
                Welcome Back
              </h1>
              <p className="text-gray-600 animate-fade-in-delay">
                Sign in to continue your journey
              </p>
            </div>

            <div className="space-y-6">
              <div className="relative group">
                <div
                  className={`absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-xl opacity-0 group-hover:opacity-10 transition-all duration-500 ${
                    focusedField === "email" ? "opacity-20 scale-105" : ""
                  }`}
                />
                <div className="relative backdrop-blur-sm bg-white/60 border border-orange-200/50 rounded-xl p-4 focus-within:border-orange-400 focus-within:bg-white/80 transition-all duration-300 hover:shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        focusedField === "email"
                          ? "bg-orange-100 text-orange-600 scale-110"
                          : "text-gray-500"
                      }`}
                    >
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="flex-1 bg-transparent text-gray-800 placeholder-gray-500 focus:outline-none font-medium"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField("")}
                    />
                  </div>
                  {focusedField === "email" && (
                    <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full animate-expand" />
                  )}
                </div>
              </div>

              <div className="relative group">
                <div
                  className={`absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-xl opacity-0 group-hover:opacity-10 transition-all duration-500 ${
                    focusedField === "password" ? "opacity-20 scale-105" : ""
                  }`}
                />
                <div className="relative backdrop-blur-sm bg-white/60 border border-orange-200/50 rounded-xl p-4 focus-within:border-orange-400 focus-within:bg-white/80 transition-all duration-300 hover:shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        focusedField === "password"
                          ? "bg-orange-100 text-orange-600 scale-110"
                          : "text-gray-500"
                      }`}
                    >
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="flex-1 bg-transparent text-gray-800 placeholder-gray-500 focus:outline-none font-medium"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField("")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-300 transform hover:scale-110"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {focusedField === "password" && (
                    <div className="absolute -bottom-1 left-4 right-4 h-0.5 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full animate-expand" />
                  )}
                </div>
              </div>

              {error && (
                <div className="backdrop-blur-sm bg-red-100/80 border border-red-200/50 rounded-xl p-3 animate-shake">
                  <p className="text-red-600 text-sm text-center font-medium">
                    {error}
                  </p>
                </div>
              )}

              <button
                onClick={handleEmailLogin}
                disabled={loading}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-orange-400/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center justify-center space-x-2">
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 group-hover:scale-110 transition-all duration-300" />
                    </>
                  )}
                </div>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300/50" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/60 backdrop-blur-sm text-gray-600 rounded-full">
                    or continue with
                  </span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full relative group overflow-hidden backdrop-blur-sm bg-white/60 hover:bg-white/80 border border-gray-200/50 hover:border-orange-300 text-gray-700 font-semibold py-4 px-6 rounded-xl transition-all duration-500 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                <div className="relative flex items-center justify-center space-x-3">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
                  ) : (
                    <>
                      <FaChrome className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                      <span>Continue with Google</span>
                    </>
                  )}
                </div>
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm">
                Don't have an account?{" "}
                <Link
                  href={"/postgres-register"}
                  className="text-orange-600 hover:text-orange-500 transition-colors duration-300 font-semibold hover:underline"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        @keyframes bounce-slow {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes bounce-delayed {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-15px) scale(1.1);
          }
        }
        @keyframes expand {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in-delay {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        @keyframes wave {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes wave-reverse {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        @keyframes float-rotate {
          0%,
          100% {
            transform: translateY(0px) rotate(45deg);
          }
          50% {
            transform: translateY(-15px) rotate(225deg);
          }
        }
        @keyframes float-scale {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
          }
          50% {
            transform: scale(1.2) rotate(180deg);
          }
        }
        @keyframes morph {
          0%,
          100% {
            border-radius: 50%;
            transform: scale(1);
          }
          25% {
            border-radius: 20%;
            transform: scale(1.3);
          }
          50% {
            border-radius: 0%;
            transform: scale(0.8);
          }
          75% {
            border-radius: 30%;
            transform: scale(1.1);
          }
        }
        @keyframes wiggle {
          0%,
          100% {
            transform: rotate(0deg) scale(1);
          }
          25% {
            transform: rotate(5deg) scale(1.1);
          }
          50% {
            transform: rotate(-5deg) scale(0.9);
          }
          75% {
            transform: rotate(3deg) scale(1.05);
          }
        }
        @keyframes flow {
          0% {
            transform: translateX(-100%) scaleX(0);
          }
          50% {
            transform: translateX(0%) scaleX(1);
          }
          100% {
            transform: translateX(100%) scaleX(0);
          }
        }
        @keyframes flow-reverse {
          0% {
            transform: translateX(100%) scaleX(0);
          }
          50% {
            transform: translateX(0%) scaleX(1);
          }
          100% {
            transform: translateX(-100%) scaleX(0);
          }
        }
        @keyframes orbit {
          from {
            transform: rotate(0deg) translateX(40px) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateX(40px) rotate(-360deg);
          }
        }
        @keyframes orbit-reverse {
          from {
            transform: rotate(360deg) translateX(30px) rotate(360deg);
          }
          to {
            transform: rotate(0deg) translateX(30px) rotate(0deg);
          }
        }
        @keyframes orbit-small {
          from {
            transform: rotate(0deg) translateX(25px) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateX(25px) rotate(-360deg);
          }
        }
        @keyframes orbit-small-reverse {
          from {
            transform: rotate(360deg) translateX(20px) rotate(360deg);
          }
          to {
            transform: rotate(0deg) translateX(20px) rotate(0deg);
          }
        }
        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.2);
          }
        }
        @keyframes pulse-glow {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.5);
          }
        }
        @keyframes pulse-ring {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(1.5);
          }
        }
        @keyframes pulse-dot {
          0%,
          100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }
        @keyframes float-gentle {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes rotate-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes text-shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-spin-reverse {
          animation: spin-reverse 15s linear infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        .animate-bounce-delayed {
          animation: bounce-delayed 4s ease-in-out infinite 1s;
        }
        .animate-expand {
          animation: expand 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-fade-in-delay {
          animation: fade-in-delay 0.8s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out 0.5s both;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animate-wave {
          animation: wave 4s ease-in-out infinite;
        }
        .animate-wave-reverse {
          animation: wave-reverse 5s ease-in-out infinite 2s;
        }
        .animate-float-rotate {
          animation: float-rotate 6s ease-in-out infinite;
        }
        .animate-float-scale {
          animation: float-scale 5s ease-in-out infinite 1s;
        }
        .animate-morph {
          animation: morph 3s ease-in-out infinite;
        }
        .animate-wiggle {
          animation: wiggle 2s ease-in-out infinite;
        }
        .animate-flow {
          animation: flow 3s ease-in-out infinite;
        }
        .animate-flow-reverse {
          animation: flow-reverse 4s ease-in-out infinite 1.5s;
        }
        .animate-orbit {
          animation: orbit 8s linear infinite;
        }
        .animate-orbit-reverse {
          animation: orbit-reverse 6s linear infinite;
        }
        .animate-orbit-small {
          animation: orbit-small 4s linear infinite;
        }
        .animate-orbit-small-reverse {
          animation: orbit-small-reverse 3s linear infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s ease-out infinite;
        }
        .animate-pulse-dot {
          animation: pulse-dot 1.5s ease-in-out infinite;
        }
        .animate-float-gentle {
          animation: float-gentle 4s ease-in-out infinite;
        }
        .animate-rotate-slow {
          animation: rotate-slow 30s linear infinite;
        }
        .animate-text-shimmer {
          animation: text-shimmer 3s ease-in-out infinite;
          background-size: 200% auto;
        }
      `}</style>
    </div>
  );
}
