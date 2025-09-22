"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import RegisterPage from "@/page/RegisterPage.jsx";
import OrganizationPage from "@/page/OrganizationPage.jsx";
import PricingPage from "@/page/PricingPage.jsx";
import { arrayUnion, Timestamp, doc, updateDoc, increment } from "firebase/firestore";
import userModel from "@/models/userModel";
import organisationModel from "@/models/organisationModel";
import { setCookie } from "cookies-next";
import paymentModel from "@/models/paymentModel";
import { db } from "@/firebase/firebase";

export default function RegistrationFlow() {
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [inviteOrgId, setInviteOrgId] = useState(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const orgId = searchParams.get("orgId");
    if (orgId) {
      setInviteOrgId(orgId);
      setStep(1);
    }
  }, [searchParams]);

  const handleRegisterNext = async (data) => {
    setUserData(data);

    const joiningOrgId = String(inviteOrgId || data.uid);

    await userModel.create({
      uid: data.uid,
      email: data.email,
      displayName: data.displayName || "",
      role: "member",
      initialOrgId: joiningOrgId,
    });

    // 2) If user existed, push new orgId (respect MAX_ORGS)
    const addRes = await userModel.addOrg(data.uid, joiningOrgId);
    if (!addRes.ok && addRes.message === "limit") {
      alert("❌ You cannot create or join more than 3 organizations.");
      return;
    }

    if (inviteOrgId) {
      const orgDetails = await organisationModel.getById(inviteOrgId);
      if (!orgDetails) {
        alert("Invalid organization link.");
        return;
      }

      setOrgData({
        ...orgDetails,
        orgId: [...(orgDetails.orgId || []), inviteOrgId],
      });

      await organisationModel.update(inviteOrgId, {
        teamMembers: arrayUnion({
          uid: data.uid,
          role: "member",
          email: data.email,
          status: "active",
          joinedAt: Timestamp.now(),
        }),
        "subscription.currentUsage.teamMembers": increment(1),
      });

      setCookie("currentUserId", data?.uid);
      setCookie("currentOrgId", inviteOrgId);
      router.push(`/org/${inviteOrgId}/dashboard`);
    } else {
      setStep(2);
    }
  };

  const handleOrgNext = (data) => {
    console.log(data)
    setOrgData(data);
    setStep(3);
  };

  const handlePricingComplete = async ({ selectedPlan, payment }) => {
    try {
      const orgId = String(orgData?.uid || userData?.uid);
      console.log(orgData,userData)
      const addRes = await userModel.addOrg(userData.uid, orgId);
      if (!addRes.ok && addRes.message === "limit") {
        alert("❌ You cannot create or join more than 3 organizations.");
        return;
      }

      const startDate = Timestamp.now();
      const endDate = Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      if (selectedPlan === "free") {
        setCookie("currentUserId", userData?.uid);
        setCookie("currentOrgId", orgId);
        alert("Free plan selected! Redirecting to dashboard...");
        router.push(`/en/org/${orgId}/dashboard`);
        return;
      }

      if (payment) {
        await paymentModel.create({
          id: payment.paymentId,
          orgId,
          paymentId: payment.paymentId,
          orderId: payment.orderId,
          amount: payment.amount / 100,
          planId: selectedPlan,
          createdAt: startDate,
          status: "success",
        });
      }

      const orgRef = doc(db, "organizations", orgId);
      await updateDoc(orgRef, {
        subscription: {
          plan: selectedPlan,
          startDate,
          endDate,
          autoRenew: true,
          renewalType: "none",
          quota: { responses: 10000, surveys: 100, teamMembers: 20 },
          currentUsage: { responses: 0, surveys: 0, teamMembers: 1 },
          trial: { isActive: false, endsAt: endDate },
        },
        businessType: "large",
        ...(payment && { transactions: arrayUnion(payment.paymentId) }),
      });

      setCookie("currentUserId", userData?.uid);
      setCookie("currentOrgId", orgId);
      alert("Registration complete! Redirecting to dashboard...");
      router.push(`/en/org/${orgId}/dashboard`);
    } catch (error) {
      console.error("Error completing pricing setup:", error);
      alert(
        "Something went wrong while completing your registration. Please try again."
      );
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <div>
      {step === 1 && <RegisterPage onNext={handleRegisterNext} />}
      {step === 2 && !inviteOrgId && (
        <OrganizationPage onNext={handleOrgNext} onBack={handleBack} />
      )}
      {step === 3 && (
        <PricingPage onBack={handleBack} onComplete={handlePricingComplete} />
      )}
    </div>
  );
}
