"use client";
import { usePricingPlans } from "@/providers/postGresPorviders/PricingPlanProvider";
import React, { useState, useEffect } from "react";

export default function PricingPage({ onBack, onComplete }) {
  const [selectedPlan, setSelectedPlan] = useState("");
   const {plans} = usePricingPlans()
  
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await plans;
        const data = res;
        setSelectedPlan(data[0]?.id || "");
      } catch (err) {
        console.error("Failed to load plans:", err);
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

  console.log(plans)

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selected = plans.find((p) => p.id === selectedPlan);
    if (selected.name.toLowerCase() === "free") {
      onComplete({ selectedPlan });
      return;
    }

    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      alert("Failed to load Razorpay SDK. Please try again.");
      return;
    }

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
        name: "AppInfoLogic",
        description: selected.name,
        order_id: data.orderId,
        handler: async (response) => {
          try {
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

            onComplete({
              selectedPlan,
              payment: {
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                amount: data.amount,
                planId: selectedPlan,
                createdAt: new Date().toISOString(),
              },
            });
          } catch (err) {
            console.error("Payment verification or storing failed", err);
          }
        },

        prefill: {
          name: "Your Name",
          email: "youremail@example.com",
        },
        theme: { color: "#3399cc" },
      });

      razorpay.open();
    } catch (err) {
      console.error("Payment initiation failed", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
        Choose a Plan
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border-2 transition-all duration-300 p-5 shadow-sm ${
              selectedPlan === plan.id
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-blue-300"
            }`}
            onClick={() => setSelectedPlan(plan.id)}
          >
            <label className="cursor-pointer block space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {plan.name}
                  </h3>
                  <p className="text-gray-500">{plan.description}</p>
                </div>
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={selectedPlan === plan.id}
                  onChange={() => setSelectedPlan(plan.id)}
                  className="w-5 h-5 text-blue-600"
                />
              </div>
              <p className="text-lg font-bold text-blue-700">{plan.price}</p>
              <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
                {plan.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </label>
          </div>
        ))}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
          >
            Back
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all"
          >
            Finish
          </button>
        </div>
      </form>
    </div>
  );
}
