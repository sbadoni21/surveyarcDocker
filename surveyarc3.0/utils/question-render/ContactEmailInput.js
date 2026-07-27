"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";

const FREE_EMAIL_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
];

export function ContactEmailInput({
  value,
  onChange,
  config = {},
  inputClasses = "",
}) {
  const searchParams = useSearchParams();

  const [error, setError] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const hasAutofilledRef = useRef(false);

  /* ------------------------------------------------
     Normalize config (safe defaults)
  ------------------------------------------------ */
  const normalizedConfig = useMemo(
    () => ({
      autoFill: !!config.autoFill,
      allowEditAfterAutofill: config.allowEditAfterAutofill !== false,
      showChangeLink: !!config.showChangeLink,
      hidden: !!config.hidden,
      required: !!config.required,

      trimSpaces: config.trimSpaces !== false,
      forceLowercase: !!config.forceLowercase,

      businessEmailOnly: !!config.businessEmailOnly,
      allowFreeEmail: config.allowFreeEmail !== false,

      allowedDomains: (config.allowedDomains || []).map((d) =>
        d.toLowerCase()
      ),
      blockedDomains: (config.blockedDomains || []).map((d) =>
        d.toLowerCase()
      ),
      allowedTlds: (config.allowedTlds || []).map((t) =>
        t.replace(/^\./, "").toLowerCase()
      ),
      blockedTlds: (config.blockedTlds || []).map((t) =>
        t.replace(/^\./, "").toLowerCase()
      ),

      customRegex: config.customRegex || null,
      customErrorMessage: config.customErrorMessage || null,
    }),
    [config]
  );

  /* ------------------------------------------------
     Validation
  ------------------------------------------------ */
  const validateEmail = (email) => {
    if (!email) {
      return normalizedConfig.required ? "Email is required" : "";
    }

    if (normalizedConfig.customRegex) {
      try {
        const r = new RegExp(normalizedConfig.customRegex);
        return r.test(email)
          ? ""
          : normalizedConfig.customErrorMessage ||
              "Email does not match required format";
      } catch {
        return "Invalid email validation rule";
      }
    }

    const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicRegex.test(email)) {
      return "Invalid email format";
    }

    const [, domainRaw] = email.split("@");
    const domain = domainRaw.toLowerCase();

    if (
      normalizedConfig.businessEmailOnly ||
      normalizedConfig.allowFreeEmail === false
    ) {
      if (FREE_EMAIL_PROVIDERS.includes(domain)) {
        return "Please use your business email";
      }
    }

    if (
      normalizedConfig.allowedDomains.length &&
      !normalizedConfig.allowedDomains.includes(domain)
    ) {
      return `Allowed domains: ${normalizedConfig.allowedDomains.join(", ")}`;
    }

    if (normalizedConfig.blockedDomains.includes(domain)) {
      return "This email domain is not allowed";
    }

    if (
      normalizedConfig.allowedTlds.length &&
      !normalizedConfig.allowedTlds.some((t) =>
        domain.endsWith(`.${t}`)
      )
    ) {
      return `Allowed TLDs: ${normalizedConfig.allowedTlds.join(", ")}`;
    }

    if (
      normalizedConfig.blockedTlds.some((t) =>
        domain.endsWith(`.${t}`)
      )
    ) {
      return "This email extension is not allowed";
    }

    return "";
  };

  /* ------------------------------------------------
     🔥 AUTO-FILL FROM URL (?email=)
  ------------------------------------------------ */
  useEffect(() => {
    if (
      !normalizedConfig.autoFill ||
      hasAutofilledRef.current ||
      value
    ) {
      return;
    }

    const urlEmail = searchParams.get("email");
    if (!urlEmail) return;

    hasAutofilledRef.current = true;

    let next = urlEmail;

    if (normalizedConfig.trimSpaces) next = next.trim();
    if (normalizedConfig.forceLowercase) next = next.toLowerCase();

    const err = validateEmail(next);
    setError(err);
    onChange(next);

    if (!normalizedConfig.allowEditAfterAutofill) {
      setIsLocked(true);
    }
  }, [
    normalizedConfig,
    searchParams,
    value,
    onChange,
  ]);

  /* ------------------------------------------------
     Input change
  ------------------------------------------------ */
  const handleChange = (raw) => {
    let val = raw;

    if (normalizedConfig.trimSpaces) val = val.trim();
    if (normalizedConfig.forceLowercase) val = val.toLowerCase();

    const err = validateEmail(val);
    setError(err);
    onChange(val);
  };

  /* ------------------------------------------------
     🔒 Hidden question
  ------------------------------------------------ */
  if (normalizedConfig.hidden) {
    return null;
  }

  /* ------------------------------------------------
     Render
  ------------------------------------------------ */
  return (
    <div className="space-y-1">
      <input
        type="email"
        value={value ?? ""}
        placeholder={config.placeholder || "Enter your email"}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isLocked}
        className={`${inputClasses} ${
          error ? "border-red-500" : ""
        } ${isLocked ? "opacity-70 cursor-not-allowed" : ""}`}
        autoComplete="email"
      />

      {/* 🔓 Change email option */}
      {isLocked && normalizedConfig.showChangeLink && (
        <button
          type="button"
          onClick={() => setIsLocked(false)}
          className="text-xs text-blue-600 hover:underline"
        >
          Change email
        </button>
      )}

      {/* ❌ Error */}
      {config.showError !== false && error && (
        <p className="text-xs text-red-500">
          {normalizedConfig.customErrorMessage || error}
        </p>
      )}
    </div>
  );
}
