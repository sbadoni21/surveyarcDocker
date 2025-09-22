import React, { useEffect, useMemo, useState } from "react";
import {
  X, Plus, Trash2, Eye, Settings, MessageCircle, Image, File, Phone, ExternalLink, Send,
  AlertTriangle, CheckCircle2 as CheckCircle, Info, Link2
} from "lucide-react";

/** --- Helpers that match WABA rules --- */

// WABA-safe name: lower-case, digits, underscores only; no spaces; trimmed; must start with letter
function slugifyWabaName(input = "") {
  const s = String(input)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s ? (/[a-z]/.test(s[0]) ? s : "a" + s) : "";
}

function countIndexedVars(str = "") {
  return [...String(str).matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
}

function hasFooterVars(str = "") {
  return /\{\{\s*\d+\s*\}\}/.test(str || "");
}

function isSequentialUnique(indices) {
  if (indices.length === 0) return true;
  const uniq = [...new Set(indices)].sort((a, b) => a - b);
  for (let i = 0; i < uniq.length; i++) if (uniq[i] !== i + 1) return false;
  return true;
}

function validatePhoneE164(val = "") {
  const s = String(val).trim();
  return /^\+[1-9]\d{7,14}$/.test(s);
}

// Allow at most ONE {{n}} in URL, none in host, must be absolute https, not localhost
function validateUrlForMeta(input) {
  let url = String(input || "").trim();
  if (!url) return { ok: false, msg: "URL is required" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const substituted = url.replace(/\{\{\d+\}\}/g, "12345");
  try {
    // eslint-disable-next-line no-new
    new URL(substituted);
  } catch {
    return { ok: false, msg: "Enter a valid absolute URL (https://...)" };
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(substituted)) {
    return { ok: false, msg: "Public URL required (no localhost/127.0.0.1)" };
  }

  const u = new URL(substituted);
  if (/\{\{|\}\}/.test(u.host)) {
    return { ok: false, msg: "Placeholders cannot appear in the domain" };
  }

  const placeholders = (url.match(/\{\{\d+\}\}/g) || []);
  if (placeholders.length > 1) {
    return { ok: false, msg: "Only one {{n}} placeholder is allowed in a URL CTA" };
  }

  return { ok: true, normalized: url };
}

/** Validate against common Meta rejection reasons */
function validateTemplateForMeta(tpl) {
  const errors = [];
  const warnings = [];

  // Name
  const safeName = slugifyWabaName(tpl.name || "");
  if (!safeName) errors.push("Template name is required.");
  if (safeName !== (tpl.name || "")) {
    warnings.push("Name adjusted to WABA format: lower-case & underscores only.");
  }
  if (safeName.length > 512) errors.push("Template name must be ≤ 512 chars.");

  // Category (surveys fit UTILITY best; MARKETING is often scrutinized)
  const category = tpl.category || "UTILITY";
  if (!["UTILITY", "AUTHENTICATION", "MARKETING"].includes(category)) {
    errors.push("Category must be one of UTILITY, AUTHENTICATION, MARKETING.");
  }
  if (category === "MARKETING") {
    warnings.push("Survey templates are safer as UTILITY; consider switching.");
  }

  // Header - Enhanced validation for format restrictions
  const header = tpl.components?.header || { type: "NONE", text: "" };
  if (header.type === "TEXT") {
    const headerText = header.text || "";
    
    // Length check
    if (headerText.length > 60) errors.push("Header TEXT must be ≤ 60 characters.");
    
    // Variable count check
    const headerVars = countIndexedVars(headerText);
    if (headerVars.length > 1) errors.push("Header TEXT can have at most one placeholder.");
    
    // Format restrictions - WhatsApp doesn't allow these in headers
    if (/[\n\r]/.test(headerText)) {
      errors.push("Header cannot contain line breaks or newlines.");
    }
    if (/[*_~`]/.test(headerText)) {
      errors.push("Header cannot contain formatting characters: * _ ~ `");
    }
    if (/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(headerText)) {
      errors.push("Header cannot contain emojis or special symbols.");
    }
    if (headerText.includes('{{') && headerText.includes('}}')) {
      // Check if variables are at start/end (not allowed)
      if (headerText.trim().startsWith('{{') || headerText.trim().endsWith('}}')) {
        errors.push("Header variables cannot appear at the very beginning or end.");
      }
    }
  } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(header.type)) {
    warnings.push("Media headers often require sample media on submission. TEXT/NONE is safer.");
  }

  // Body
  const bodyText = tpl.components?.body?.text || "";
  if (!bodyText.trim()) errors.push("Body text is required.");
  if (bodyText.length > 1024) errors.push("Body must be ≤ 1024 characters.");
  const bodyVars = countIndexedVars(bodyText);
  if (!isSequentialUnique(bodyVars)) {
    errors.push("Body placeholders must be sequential {{1}}, {{2}}, … with no gaps or repeats.");
  }
  
  // Check for variables at start/end of body (problematic)
  if (bodyText.trim().startsWith('{{') || bodyText.trim().endsWith('}}')) {
    warnings.push("Variables at the very start/end of messages may cause issues. Add some text before/after.");
  }

  // Footer (no variables allowed by policy)
  const footerText = tpl.components?.footer?.text || "";
  if (footerText.length > 60) errors.push("Footer must be ≤ 60 characters.");
  if (hasFooterVars(footerText)) {
    errors.push("Footer cannot contain variables ({{n}}). Move variables to body.");
  }

  // Buttons policy
  const buttons = Array.isArray(tpl.components?.buttons) ? tpl.components.buttons : [];
  if (buttons.length > 0) {
    const types = new Set(buttons.map((b) => String(b.type || "")));
    const hasQR = types.has("QUICK_REPLY");
    const hasCTA = types.has("URL") || types.has("PHONE_NUMBER");
    if (hasQR && hasCTA) {
      errors.push("Buttons must be either all Quick Replies (max 3) OR Call-To-Action (URL/PHONE, max 2).");
    }
    if (hasQR) {
      if (buttons.length > 3) errors.push("Max 3 Quick Reply buttons allowed.");
    } else {
      if (buttons.length > 2) errors.push("Max 2 Call-To-Action buttons (URL/Phone) allowed.");
    }

    buttons.forEach((b, i) => {
      const label = `Button ${i + 1}`;
      if (!b.text || b.text.length === 0) errors.push(`${label}: text is required.`);
      if ((b.text || "").length > 25) errors.push(`${label}: text must be ≤ 25 chars.`);

      if (b.type === "URL") {
        const res = validateUrlForMeta(b.url);
        if (!res.ok) errors.push(`${label} (URL): ${res.msg}`);
      }
      if (b.type === "PHONE_NUMBER") {
        if (!validatePhoneE164(b.phone_number || b.phone)) {
          errors.push(`${label} (Phone): must be E.164 format like +15551234567.`);
        }
      }
    });
  }

  // Light content checks for surveys (avoid promotional language when using UTILITY)
  if (category === "UTILITY" && /sale|offer|discount|buy now|shop now/i.test(bodyText)) {
    warnings.push("Utility templates should avoid promotional language; keep it service/feedback-focused.");
  }

  // Check for common rejection patterns
  if (/test|testing|hello world|sample/i.test(bodyText) && bodyText.length < 50) {
    warnings.push("Avoid test/sample content. Use realistic business messaging for better approval odds.");
  }

  // Normalized template to save
  const normalized = {
    ...tpl,
    name: safeName,
    category: category || "UTILITY",
    components: {
      ...tpl.components,
      header: { 
        ...(tpl.components?.header || {}), 
        text: (tpl.components?.header?.text || "").trim().replace(/[\n\r]/g, ' ') // Remove line breaks
      },
      body: { text: bodyText.trim() },
      footer: { text: footerText.trim() },
      buttons: buttons.map((b) => ({ ...b, text: (b.text || "").trim() })),
    },
  };

  return { ok: errors.length === 0, errors, warnings, normalized };
}

/** Replace {{n}} with preview values */
function previewReplace(text = "", vars = []) {
  let out = text;
  vars.forEach((v, i) => {
    out = out.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, "g"), v);
  });
  return out;
}

export default function WhatsAppTemplateEditor({ open, initial, onClose, onSave }) {
  const [template, setTemplate] = useState({
    name: "",
    language: "en_US",
    category: "UTILITY", // safer default for surveys
    status: "draft",
    components: {
      header: { type: "NONE", text: "" },
      body: { text: "Hi {{1}}, could you spare 15 seconds for a quick survey?" },
      footer: { text: "" },
      buttons: []
    }
  });

  const [activeTab, setActiveTab] = useState("design");
  const [previewVars, setPreviewVars] = useState(["John", "Brand", "12345"]);
  const [result, setResult] = useState({ errors: [], warnings: [] });

  useEffect(() => {
    if (initial) {
      // Keep category defaulting to UTILITY if the incoming one is missing
      const safe = {
        ...initial,
        category: initial.category || "UTILITY",
      };
      setTemplate(safe);
    }
  }, [initial]);

  // Live validation
  const validation = useMemo(() => validateTemplateForMeta(template), [template]);
  useEffect(() => {
    setResult({ errors: validation.errors, warnings: validation.warnings });
  }, [validation]);

  // Calculate number of variables in body text
  const bodyVars = useMemo(() => {
    const matches = (template.components.body.text || '').match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  }, [template.components.body.text]);

  const updateTemplate = (path, value) => {
    setTemplate((prev) => {
      const next = { ...prev };
      const parts = path.split(".");
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const addButton = () => {
    const btns = [...(template.components.buttons || [])];
    btns.push({ type: "QUICK_REPLY", text: "Start Survey" });
    updateTemplate("components.buttons", btns);
  };

  const removeButton = (index) => {
    const btns = (template.components.buttons || []).filter((_, i) => i !== index);
    updateTemplate("components.buttons", btns);
  };

  const updateButton = (index, field, value) => {
    const btns = [...(template.components.buttons || [])];
    btns[index] = { ...btns[index], [field]: value };
    updateTemplate("components.buttons", btns);
  };

  const renderPreview = () => {
    const { header, body, footer, buttons } = template.components;
    return (
      <div className="bg-gradient-to-b from-green-100 to-green-50 p-4 rounded-lg overflow-y-scroll">
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <MessageCircle size={16} />
          <span>WhatsApp Business</span>
        </div>

        <div className="bg-white rounded-lg shadow-sm max-w-sm mx-auto overflow-hidden">
          {header.type !== "NONE" && (
            <div className="border-b p-3">
              {header.type === "TEXT" && (
                <div className="font-medium text-gray-800">{previewReplace(header.text, previewVars)}</div>
              )}
              {header.type === "IMAGE" && (
                <div className="flex items-center gap-2 text-gray-600"><Image size={16} /><span className="text-sm">Image Header</span></div>
              )}
              {header.type === "VIDEO" && (
                <div className="flex items-center gap-2 text-gray-600"><File size={16} /><span className="text-sm">Video Header</span></div>
              )}
              {header.type === "DOCUMENT" && (
                <div className="flex items-center gap-2 text-gray-600"><File size={16} /><span className="text-sm">Document Header</span></div>
              )}
            </div>
          )}

          <div className="p-3">
            <div className="whitespace-pre-wrap text-gray-800">{previewReplace(body.text, previewVars)}</div>
          </div>

          {footer.text && (
            <div className="px-3 pb-3">
              <div className="text-xs text-gray-500 italic">{previewReplace(footer.text, previewVars)}</div>
            </div>
          )}

          {buttons.length > 0 && (
            <div className="border-t p-2 space-y-1 bg-gray-50">
              {buttons.map((btn, index) => (
                <div key={index} className="w-full">
                  {btn.type === "QUICK_REPLY" && (
                    <button className="w-full py-2 px-3 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50">
                      {btn.text}
                    </button>
                  )}
                  {btn.type === "URL" && (
                    <button className="w-full py-2 px-3 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 flex items-center justify-center gap-1">
                      <ExternalLink size={12} />
                      {btn.text}
                    </button>
                  )}
                  {btn.type === "PHONE_NUMBER" && (
                    <button className="w-full py-2 px-3 text-sm text-green-600 border border-green-200 rounded hover:bg-green-50 flex items-center justify-center gap-1">
                      <Phone size={12} />
                      {btn.text}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Variables */}
        <div className="mt-4 p-3 bg-blue-50 rounded text-xs">
          <div className="font-medium text-blue-800 mb-2">Preview Variables:</div>
          <div className="space-y-1">
            {previewVars.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-blue-600 font-mono">{`{{${index + 1}}}`}</span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const nv = [...previewVars];
                    nv[index] = e.target.value;
                    setPreviewVars(nv);
                  }}
                  className="flex-1 px-2 py-1 border rounded text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (!open) return null;

  const bodyVarIndices = countIndexedVars(template.components?.body?.text || "");
  const headerVarIndices = template.components?.header?.type === "TEXT"
    ? countIndexedVars(template.components?.header?.text || "")
    : [];

  const canSave = validation.ok; // block save if we know it will be rejected

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-scroll">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-scroll">
        {/* Title */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold">
            {initial?.id ? "Edit" : "Create"} WhatsApp Template
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Always-visible Template Name row */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2 px-6">
            Template Name (WABA) *
          </label>

          <div className="flex gap-2 px-6">
            <input
              type="text"
              value={template.name}
              onChange={(e) => updateTemplate("name", e.target.value)}
              onBlur={(e) => updateTemplate("name", slugifyWabaName(e.target.value))}
              placeholder="e.g., survey_followup_invite"
              className="w-full border rounded-lg px-3 py-2"
            />
            <button
              type="button"
              onClick={() => updateTemplate("name", slugifyWabaName(template.name))}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              title="Make it lowercase_with_underscores"
            >
              Slugify
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-1 px-6">
            Lowercase letters, digits, and underscores only. Must start with a letter.
          </p>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b">
              <button
                onClick={() => setActiveTab("design")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "design" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Settings size={16} className="inline mr-2" />
                Design
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "settings" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Settings size={16} className="inline mr-2" />
                Settings
              </button>
            </div>

            {activeTab === "settings" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={template.name}
                      onChange={(e) => updateTemplate("name", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., survey_followup_invite"
                    />
                    <button
                      type="button"
                      onClick={() => updateTemplate("name", slugifyWabaName(template.name))}
                      className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                      title="Slugify"
                    >
                      <Link2 size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Lower-case letters, digits, underscores only. Must start with a letter.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                    <select
                      value={template.language}
                      onChange={(e) => updateTemplate("language", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="en_US">English (US)</option>
                      <option value="en_GB">English (UK)</option>
                      <option value="es_ES">Spanish</option>
                      <option value="fr_FR">French</option>
                      <option value="hi_IN">Hindi</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={template.category}
                      onChange={(e) => updateTemplate("category", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="UTILITY">Utility (recommended for surveys)</option>
                      <option value="AUTHENTICATION">Authentication</option>
                      <option value="MARKETING">Marketing</option>
                    </select>
                    {template.category === "MARKETING" && (
                      <p className="text-xs text-amber-600 mt-1">Surveys under "Marketing" get rejected more often. Use "Utility".</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "design" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Header (Optional)</h4>
                  <div className="space-y-3">
                    <select
                      value={template.components.header.type}
                      onChange={(e) => updateTemplate("components.header.type", e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="NONE">No Header</option>
                      <option value="TEXT">Text Header</option>
                      <option value="IMAGE">Image Header</option>
                      <option value="VIDEO">Video Header</option>
                      <option value="DOCUMENT">Document Header</option>
                    </select>

                    {template.components.header.type === "TEXT" && (
                      <>
                        <input
                          type="text"
                          value={template.components.header.text}
                          onChange={(e) => updateTemplate("components.header.text", e.target.value)}
                          placeholder="Survey feedback request"
                          maxLength={60}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>Header vars: {headerVarIndices.length || 0} {headerVarIndices.length > 1 && "• (max 1 allowed)"}</div>
                          <div className="text-amber-600">⚠️ Headers cannot contain: line breaks, *formatting*, emojis, or variables at start/end</div>
                        </div>
                      </>
                    )}
                    {["IMAGE", "VIDEO", "DOCUMENT"].includes(template.components.header.type) && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Info size={12} />
                        Media headers may require a sample media handle on submission; TEXT/NONE is safer.
                      </p>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Body Text *</h4>
                  <textarea
                    value={template.components.body.text}
                    onChange={(e) => updateTemplate("components.body.text", e.target.value)}
                    placeholder="Ask for feedback. Use {{1}}, {{2}}… for variables."
                    rows={6}
                    maxLength={1024}
                    className="w-full border rounded-lg px-3 py-2 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ≤ 1024 chars • placeholders {`{{1}}`}, {`{{2}}`} … • found: {bodyVarIndices.length} {isSequentialUnique(bodyVarIndices) ? "" : "• (must be sequential)"} • count: {bodyVars}
                  </p>
                </div>

                {/* Footer */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Footer (Optional)</h4>
                  <input
                    type="text"
                    value={template.components.footer.text}
                    onChange={(e) => updateTemplate("components.footer.text", e.target.value)}
                    placeholder="Footer text (≤ 60 chars, no variables allowed)"
                    maxLength={60}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  {hasFooterVars(template.components.footer.text) && (
                    <p className="text-xs text-red-600 mt-1">Footer cannot contain variables. Move them to the body.</p>
                  )}
                </div>

                {/* Buttons */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Buttons (Optional)</h4>
                    <button
                      onClick={addButton}
                      disabled={(template.components.buttons || []).length >= 3}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Add Button
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(template.components.buttons || []).map((button, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Button {index + 1}</span>
                          <button
                            onClick={() => removeButton(index)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={button.type}
                            onChange={(e) => updateButton(index, "type", e.target.value)}
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="QUICK_REPLY">Quick Reply</option>
                            <option value="URL">Website URL</option>
                            <option value="PHONE_NUMBER">Phone Number</option>
                          </select>

                          <input
                            type="text"
                            value={button.text || ""}
                            onChange={(e) => updateButton(index, "text", e.target.value)}
                            placeholder="Button text (≤25 chars)"
                            maxLength={25}
                            className="border rounded px-2 py-1 text-sm"
                          />
                        </div>

                        {button.type === "URL" && (
                          <input
                            type="url"
                            value={button.url || ""}
                            onChange={(e) => updateButton(index, "url", e.target.value)}
                            placeholder="https://surveyarc.com/form?campaignID={{1}}&userKey={{2}}"
                            className="w-full border rounded px-2 py-1 text-sm mt-2"
                          />
                        )}

                        {button.type === "PHONE_NUMBER" && (
                          <input
                            type="tel"
                            value={button.phone_number || ""}
                            onChange={(e) => updateButton(index, "phone_number", e.target.value)}
                            placeholder="+15551234567"
                            className="w-full border rounded px-2 py-1 text-sm mt-2"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Buttons must be either all Quick Replies (max 3) <b>or</b> Call-To-Action (URL/Phone, max 2).
                    For dynamic URLs, only one <code>{`{{n}}`}</code> is allowed and not in the domain.
                  </p>
                </div>

                {/* Live validation status */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Validation</h4>
                  {result.errors.length === 0 ? (
                    <div className="text-green-700 flex items-center gap-2">
                      <CheckCircle size={16} /> No blocking issues found.
                    </div>
                  ) : (
                    <ul className="text-red-700 list-disc ml-5 space-y-1">
                      {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  {result.warnings.length > 0 && (
                    <>
                      <div className="text-amber-700 flex items-center gap-2 mt-3">
                        <AlertTriangle size={16} /> Warnings
                      </div>
                      <ul className="text-amber-700 list-disc ml-5 space-y-1">
                        {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="w-80 border-l bg-gray-50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye size={16} />
              <span className="font-medium">Preview</span>
            </div>
            {renderPreview()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Templates must be approved by WhatsApp before use. Keep content service/feedback oriented for UTILITY.
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={() => {
                const v = validateTemplateForMeta(template);
                if (!v.ok) return;
                onSave(template.id, v.normalized);
              }}
              disabled={!canSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              title={!canSave ? "Fix validation errors before saving" : "Save and submit later from the list"}
            >
              <Send size={16} />
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}