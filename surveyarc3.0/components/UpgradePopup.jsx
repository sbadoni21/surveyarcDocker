"use client";
import React, { useEffect, useState } from "react";
import paymentModel from "@/models/paymentModel";
import { db } from "@/firebase/firebase";
import {
  Timestamp,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "firebase/firestore";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function UpgradePopup({ onClose, orgData }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch("/api/get-plans");
        const data = await res.json();
        setPlans(data);
        setSelectedPlan(data[0]?.id || "");
      } catch (err) {
        console.error("Error fetching plans:", err);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    const selected = plans.find((p) => p.id === selectedPlan);
    if (!selected) return;

    if (selected.name.toLowerCase() === "free") {
      return alert("You're already on the free plan.");
    }

    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      alert("Razorpay SDK failed to load.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: selected.amount * 100,
          planId: selectedPlan,
        }),
      });

      const data = await res.json();

      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: "INR",
        name: "Survey Arc",
        description: selected.name,
        order_id: data.orderId,
        handler: async (response) => {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();
          if (!verifyData.success) {
            alert("Payment verification failed");
            return;
          }

          const orgId = orgData?.uid;
          const startDate = Timestamp.now();
          const endDate = Timestamp.fromDate(
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          );

          await paymentModel.create({
            id: response.razorpay_payment_id,
            orgId,
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            amount: data.amount / 100,
            planId: selectedPlan,
            createdAt: startDate,
            status: "success",
          });

          const orgSnap = await getDoc(doc(db, "organizations", orgId));
          const existing = orgSnap.exists() ? orgSnap.data() : {};
          const prevUsage = existing?.subscription?.currentUsage || {
            responses: 0,
            surveys: 0,
            teamMembers: 1,
          };

          await updateDoc(doc(db, "organizations", orgId), {
            subscription: {
              plan: selectedPlan,
              startDate,
              endDate,
              autoRenew: true,
              renewalType: "none",
              quota: {
                responses: 10000,
                surveys: 100,
                teamMembers: 50,
              },
              currentUsage: prevUsage,
              trial: {
                isActive: false,
                endsAt: endDate,
              },
            },
            transactions: arrayUnion(response.razorpay_payment_id),
          });

          alert("Upgrade successful!");
          onClose();
        },
        prefill: {
          name: orgData?.displayName || "User",
          email: orgData?.email || "user@example.com",
        },
        theme: { color: "#ED7A13" },
      });

      razorpay.open();
    } catch (err) {
      console.error("Upgrade failed", err);
      alert("Upgrade failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl p-8 relative max-h-[90vh] overflow-y-auto transition-all">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-black text-2xl"
        >
          &times;
        </button>

        <h2 className="text-3xl font-bold text-center mb-8 text-blue-700">
          Upgrade Your Plan
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plansLoading
            ? Array.from({ length: 2 }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-xl border border-gray-200 shadow-sm"
                >
                  <Skeleton height={24} width={100} />
                  <Skeleton height={20} width={60} style={{ marginTop: 10 }} />
                  <Skeleton count={3} height={14} style={{ marginTop: 10 }} />
                </div>
              ))
            : plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-xl border px-6 py-5 transition-all cursor-pointer ${
                    selectedPlan === plan.id
                      ? "bg-blue-50 border-blue-500 shadow-md"
                      : "border-gray-200 hover:border-blue-400 hover:shadow"
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-blue-600 font-semibold text-base mb-2">
                    {plan.price}
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    {plan.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
        </div>

        <div className="mt-10 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUpgrade}
            disabled={loading || plansLoading}
            className={`px-6 py-2 rounded-lg font-semibold text-white transition ${
              loading || plansLoading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Processing..." : "Upgrade Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
