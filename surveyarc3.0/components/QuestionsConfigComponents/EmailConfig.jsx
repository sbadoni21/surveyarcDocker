"use client";

import React from "react";

export default function EmailConfig({ config = {}, updateConfig }) {
  const toggle = (key) => updateConfig(key, !config[key]);

  return (
    <div className="space-y-6 dark:bg-[#1A1A1E]">

      {/* =====================================================
         🔒 HIDDEN QUESTION (PROMINENT)
      ===================================================== */}
      <div className="p-4 border border-yellow-400/60 rounded-lg bg-yellow-50/10">
        <Checkbox
          label="Hide this question from respondents"
          checked={config.hidden}
          onChange={() => toggle("hidden")}
        />
        <p className="text-xs mt-1 text-[#96949C]">
          Hidden questions are not shown to users. Useful for panel emails,
          system values, database prefill, or tracking.
        </p>
      </div>

      {/* =====================================================
         ⚡ AUTO-FILL CONTROLS
      ===================================================== */}
      <div className="p-4 border border-blue-400/50 rounded-lg bg-blue-50/5 space-y-3">
        <Checkbox
          label="Auto-fill email from panel / URL / database / sheet"
          checked={config.autoFill}
          onChange={() => toggle("autoFill")}
        />
        <p className="text-xs text-[#96949C]">
          Automatically prefill this email if available (e.g. ?email= in URL,
          panel links, uploaded audience sheets, or contact database).
        </p>

        {config.autoFill && (
          <>
            <Checkbox
              label="Allow respondent to change auto-filled email"
              checked={config.allowEditAfterAutofill}
              onChange={() => toggle("allowEditAfterAutofill")}
            />

            <Checkbox
              label='Show "Change email" option to respondent'
              checked={config.showChangeLink}
              onChange={() => toggle("showChangeLink")}
            />
          </>
        )}
      </div>

      {/* =====================================================
         BASIC SETTINGS
      ===================================================== */}
      <Field label="Placeholder">
        <input
          className="input"
          value={config.placeholder || ""}
          onChange={(e) => updateConfig("placeholder", e.target.value)}
          placeholder="name@company.com"
        />
      </Field>

      <Checkbox
        label="Required"
        checked={config.required}
        onChange={() => toggle("required")}
      />

      {/* =====================================================
         EMAIL RULES
      ===================================================== */}
      <Checkbox
        label="Allow business emails only"
        checked={config.businessEmailOnly}
        onChange={() => toggle("businessEmailOnly")}
      />

      <Checkbox
        label="Block free email providers (Gmail, Yahoo, etc.)"
        checked={config.blockDisposableEmails}
        onChange={() => toggle("blockDisposableEmails")}
      />

      <Checkbox
        label="Block + addressing (john+test@company.com)"
        checked={config.blockPlusAddressing}
        onChange={() => toggle("blockPlusAddressing")}
      />

      {/* =====================================================
         DOMAIN & TLD CONTROLS
      ===================================================== */}
      <TagInput
        label="Allowed Domains (Whitelist)"
        value={config.allowedDomains || []}
        placeholder="company.com"
        onChange={(v) => updateConfig("allowedDomains", v)}
      />

      <TagInput
        label="Blocked Domains"
        value={config.blockedDomains || []}
        placeholder="gmail.com, yahoo.com"
        onChange={(v) => updateConfig("blockedDomains", v)}
      />

      <TagInput
        label="Allowed TLDs"
        value={config.allowedTlds || []}
        placeholder=".com, .in"
        onChange={(v) => updateConfig("allowedTlds", v)}
      />

      <TagInput
        label="Blocked TLDs"
        value={config.blockedTlds || []}
        placeholder=".tk, .ml"
        onChange={(v) => updateConfig("blockedTlds", v)}
      />

      {/* =====================================================
         FORMATTING
      ===================================================== */}
      <Checkbox
        label="Auto-trim spaces"
        checked={config.trimSpaces}
        onChange={() => toggle("trimSpaces")}
      />

      <Checkbox
        label="Force lowercase"
        checked={config.forceLowercase}
        onChange={() => toggle("forceLowercase")}
      />

      {/* =====================================================
         LIMITS & HELPERS
      ===================================================== */}
      <Field label="Max Length">
        <input
          type="number"
          className="input"
          value={config.maxLength || 254}
          onChange={(e) =>
            updateConfig("maxLength", Number(e.target.value))
          }
        />
      </Field>

      <Field label="Helper Text">
        <input
          className="input"
          value={config.helperText || ""}
          onChange={(e) => updateConfig("helperText", e.target.value)}
        />
      </Field>

      <Field label="Custom Error Message">
        <input
          className="input"
          value={config.customErrorMessage || ""}
          onChange={(e) =>
            updateConfig("customErrorMessage", e.target.value)
          }
        />
      </Field>

      {/* =====================================================
         ADVANCED
      ===================================================== */}
      <Field label="Custom Regex (Advanced)">
        <input
          className="input font-mono text-xs"
          value={config.customRegex || ""}
          onChange={(e) => updateConfig("customRegex", e.target.value)}
          placeholder="^[a-z0-9._%+-]+@company\\.com$"
        />
      </Field>
    </div>
  );
}

/* =====================================================
   HELPERS
===================================================== */

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm dark:text-[#CBC9DE] cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={onChange} />
      {label}
    </label>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm dark:text-[#96949C]">{label}</label>
      {children}
    </div>
  );
}

function TagInput({ label, value = [], onChange, placeholder }) {
  return (
    <Field label={label}>
      <input
        className="input"
        value={value.join(", ")}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          )
        }
      />
    </Field>
  );
}

/* =====================================================
   SHARED INPUT STYLE (OPTIONAL)
===================================================== */
const inputClass =
  "border border-[#8C8A97] dark:text-[#CBC9DE] outline-none dark:bg-[#1A1A1E] p-2 rounded";

