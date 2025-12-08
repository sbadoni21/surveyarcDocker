"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import QUESTION_TYPES from "@/enums/questionTypes";
import { useSalesforceContacts } from "@/providers/postGresPorviders/SalesforceContactProvider";
import { useSalesforceAccounts } from "@/providers/postGresPorviders/SalesforceAccountProvider"; // Add this import

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const CampaignCreateModal = ({
  isOpen,
  onClose,
  userId,
  orgId,
  onCreate,
  lists = [],
  contacts = [],
  surveys = [],
  onLoadLists,
  onLoadContacts,
  onLoadSurveys,
  onLoadSurveyQuestions,
  surveyQuestions = [],
}) => {
const [formData, setFormData] = useState({
  campaignName: "",
  surveyId: "",
  channel: "email",
  fallbackChannel: null,
  status: "scheduled",
  channelPriority: [],
  orgId,
  userId,

  // 🔴 recipients
  recipientSource: "internal",       // "internal" | "salesforce"
  contactListId: "",
  salesforceAccountId: "",           // for Salesforce tab
  contactFilters: {},

  emailSubject: "",
  emailBodyHtml: "",
  emailFromName: "",
  emailReplyTo: "",
  smsMessage: "",
  whatsappMessage: "",
  whatsappTemplateId: "",
  voiceScript: "",
  scheduledAt: null,
  metaData: {},
});

  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);
  const [pickerQuestionId, setPickerQuestionId] = useState("");

// Salesforce contacts (external)
const { contacts: sfContacts, listByAccount } = useSalesforceContacts();

// Salesforce accounts
const { accounts, list: listAccounts } = useSalesforceAccounts();

// Internal contacts (from props)
const internalContacts = contacts || [];

  console.log(listByAccount)


  const hasLoadedLists = useRef(false);
  const hasLoadedContacts = useRef(false);
  const hasLoadedSurveys = useRef(false);
  const hasLoadedAccounts = useRef(false);

  const quillRef = useRef(null);

useEffect(() => {
  if (!isOpen) return;

  // 🔥 Load Salesforce Accounts Automatically
  if (!hasLoadedAccounts.current && listAccounts && (!accounts || accounts.length === 0)) {
    listAccounts();
    hasLoadedAccounts.current = true;
  }

  if (!hasLoadedLists.current && onLoadLists && lists.length === 0) {
    onLoadLists();
    hasLoadedLists.current = true;
  }
  if (!hasLoadedContacts.current && onLoadContacts && contacts.length === 0) {
    onLoadContacts();
    hasLoadedContacts.current = true;
  }
  if (!hasLoadedSurveys.current && onLoadSurveys && surveys.length === 0) {
    onLoadSurveys();
    hasLoadedSurveys.current = true;
  }
}, [isOpen, listAccounts, accounts, lists.length, contacts.length, surveys.length]);

  const toggleContactSelection = (contactId) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const getUserTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  };

  const handleQuillChange = (content, delta, source, editor) => {
    setFormData((prev) => ({
      ...prev,
      emailBodyHtml: editor.getHTML(),
    }));
  };

  const addTime = (value, unit) => {
    const now = new Date();
    switch (unit) {
      case "minutes":
        now.setMinutes(now.getMinutes() + value);
        break;
      case "hours":
        now.setHours(now.getHours() + value);
        break;
      case "days":
        now.setDate(now.getDate() + value);
        break;
      case "weeks":
        now.setDate(now.getDate() + value * 7);
        break;
      case "months":
        now.setMonth(now.getMonth() + value);
        break;
      default:
        break;
    }
    return now.toISOString();
  };

  const insertHtmlAtCursor = (htmlString) => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();

    quill.clipboard.dangerouslyPasteHTML(index, htmlString, "user");
    quill.setSelection(index + 1);

    setFormData((prev) => ({
      ...prev,
      emailBodyHtml: quill.root.innerHTML,
    }));
  };

  const extractOptionsForQuestion = (q) => {
    if (!q) return [];
    const type = q.type;
    const cfg = q.config || {};

    if (
      type === QUESTION_TYPES.MULTIPLE_CHOICE ||
      type === QUESTION_TYPES.CHECKBOX
    ) {
      const src = cfg.choices || cfg.options || [];
      return src.map((o, i) =>
        typeof o === "string"
          ? { id: `opt_${i + 1}`, label: o }
          : { id: o.id || `opt_${i + 1}`, label: o.label || o.text || `Option ${i + 1}` }
      );
    }

    if (type === QUESTION_TYPES.DROPDOWN) {
      const src = cfg.options || [];
      return src.map((o, i) =>
        typeof o === "string"
          ? { id: `opt_${i + 1}`, label: o }
          : { id: o.id || `opt_${i + 1}`, label: o.label || o.text || `Option ${i + 1}` }
      );
    }

    if (type === QUESTION_TYPES.NPS) {
      const min = 0;
      const max = 10;
      const minLabel = cfg.minLabel || "Not at all likely";
      const maxLabel = cfg.maxLabel || "Extremely likely";

      const arr = [];
      for (let v = min; v <= max; v++) {
        let extra = "";
        if (v === min) extra = ` — ${minLabel}`;
        if (v === max) extra = ` — ${maxLabel}`;
        arr.push({ id: String(v), label: `${v}${extra}` });
      }
      return arr;
    }

    if (
      type === QUESTION_TYPES.OPINION_SCALE ||
      type === QUESTION_TYPES.SLIDER ||
      type === QUESTION_TYPES.RATING
    ) {
      const min = cfg.min ?? 1;
      const max = cfg.max ?? cfg.maxStars ?? 5;
      const step = cfg.step ?? 1;
      const res = [];
      for (let v = min; v <= max; v += step) {
        res.push({ id: String(v), label: String(v) });
      }
      return res;
    }

    if (type === QUESTION_TYPES.SEMANTIC_DIFF) {
      const items = cfg.items || [];
      return items.map((it, i) => ({
        id: it.id || `sd_${i + 1}`,
        label: `${it.left} ↔ ${it.right}`,
      }));
    }

    if (
      type === QUESTION_TYPES.TABLE_GRID ||
      type === QUESTION_TYPES.MATRIX ||
      type === QUESTION_TYPES.MATRIX_RATING
    ) {
      const cols = cfg.columns || [];
      return cols.map((c, i) =>
        typeof c === "string"
          ? { id: `col_${i + 1}`, label: c }
          : { id: c.id || `col_${i + 1}`, label: c.label || c.text || `Column ${i + 1}` }
      );
    }

    if (type === QUESTION_TYPES.COMPARISON_GRID) {
      const brands = cfg.brands || [];
      return brands.map((b, i) =>
        typeof b === "string"
          ? { id: `brand_${i + 1}`, label: b }
          : { id: b.id || `brand_${i + 1}`, label: b.label || b.text || `Brand ${i + 1}` }
      );
    }

    if (type === QUESTION_TYPES.SEGMENTATION_SELECTOR) {
      const segs = cfg.segments || [];
      return segs.map((s, i) => ({
        id: s.id || s.code || `seg_${i + 1}`,
        label: s.label || s.id || `Segment ${i + 1}`,
      }));
    }

    if (type === QUESTION_TYPES.PERSONA_QUIZ) {
      const personas = cfg.personas || [];
      return personas.map((p, i) => ({
        id: p.id || `persona_${i + 1}`,
        label: p.label || p.id || `Persona ${i + 1}`,
      }));
    }

    if (type === QUESTION_TYPES.WEIGHTED_MULTI) {
      const opts = cfg.options || [];
      return opts.map((o, i) => ({
        id: o.id || `opt_${i + 1}`,
        label: o.label || `Option ${i + 1}`,
      }));
    }

    const raw =
      cfg.options ||
      cfg.choices ||
      cfg.items ||
      cfg.rows ||
      cfg.attributes ||
      [];
    return raw.map((o, i) => {
      if (typeof o === "string") {
        return { id: `opt_${i + 1}`, label: o };
      }
      return {
        id: o.id || `opt_${i + 1}`,
        label: o.label || o.text || o.name || `Option ${i + 1}`,
      };
    });
  };

  const insertPlainTextToken = (token) => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();

    quill.insertText(index, token, "user");
    quill.setSelection(index + token.length);

    setFormData((prev) => ({
      ...prev,
      emailBodyHtml: quill.root.innerHTML,
    }));
  };

  const insertVariable = (variable) => {
    insertPlainTextToken(variable);
    setShowVariableMenu(false);
  };

  const insertSurveyLink = () => {
    const params = [
      "campaign_id={{campaign_id}}",
      "survey_id={{survey_id}}",
      "contact_id={{contact_id}}",
      "tracking_token={{tracking_token}}",
      "email={{email}}",
      "org_id={{org_id}}",
      "user_id={{user_id}}",
      "phone={{phone}}",
      "source=email",
      "channel=campaign",
    ].join("&");

    const surveyHref = `{{survey_link}}?${params}`;

    const htmlButton = `
      <p>
        <a href="${surveyHref}"
           style="display:inline-block;padding:10px 18px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:500;">
          Start Survey
        </a>
      </p>
    `.trim();

    insertHtmlAtCursor(htmlButton);
  };

  const embedSelectedQuestion = () => {
    if (!pickerQuestionId || !formData.surveyId) {
      alert("Please select a survey and a question first.");
      return;
    }

    const q =
      surveyQuestions.find(
        (qq) =>
          qq.question_id === pickerQuestionId ||
          qq.questionId === pickerQuestionId
      ) || null;

    if (!q) {
      alert("Question not found.");
      return;
    }

    const label =
      q.label || q.description || q.questionText || "Survey Question";

    const options = extractOptionsForQuestion(q);

    if (!options.length) {
      alert("This question has no options we can embed.");
      return;
    }

    const qid = q.question_id || q.questionId;

    const linksHtml = options
      .map((opt) => {
        const href =
          `{{survey_link}}` +
          `?campaign_id={{campaign_id}}` +
          `&survey_id={{survey_id}}` +
          `&org_id={{org_id}}` +
          `&contact_id={{contact_id}}` +
          `&prefill_q=${qid}` +
          `&prefill_a=${encodeURIComponent(opt.id)}` +
          `&source=email&channel=campaign`;

        return `
        <p style="margin:4px 0;">
          <a href="${href}"
             style="display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid #d1d5db;text-decoration:none;color:#111827;font-size:14px;">
            ${opt.label}
          </a>
        </p>
      `;
      })
      .join("");

    const blockHtml = `
    <div style="margin:16px 0;padding:12px 16px;border-radius:12px;border:1px solid #e5e7eb;background:#f9fafb;">
      <p style="margin:0 0 8px 0;font-weight:600;font-size:15px;color:#111827;">
        ${label}
      </p>
      ${linksHtml}
    </div>
  `.trim();

    insertHtmlAtCursor(blockHtml);
    setShowQuestionPicker(false);
    setPickerQuestionId("");
  };

const handleSubmit = async () => {
  if (!formData.campaignName || !formData.surveyId) {
    alert("Please fill Campaign Name and Survey.");
    return;
  }

  const isInternalSource = formData.recipientSource !== "salesforce";

  // ✅ Different validation depending on source
  if (isInternalSource) {
    if (!formData.contactListId && selectedContacts.length === 0) {
      alert("Please select a contact list or individual contacts.");
      return;
    }
  } else {
    // Salesforce source
    if (!formData.salesforceAccountId || selectedContacts.length === 0) {
      alert(
        "Please select a Salesforce account and at least one Salesforce contact."
      );
      return;
    }
  }

  // ✅ Build contactFilters depending on source
  let contactFilters = formData.contactFilters || {};

  if (selectedContacts.length > 0) {
    if (isInternalSource) {
      // Internal contacts or lists
      contactFilters = {
        ...contactFilters,
        contactIds: selectedContacts, // internal contact IDs
      };
    } else {
      // Salesforce contacts
      contactFilters = {
        ...contactFilters,
        salesforceContactIds: selectedContacts,
        salesforceAccountId: formData.salesforceAccountId,
      };
    }
  }

  const submitData = {
    ...formData,
    contactFilters,
    metaData: {
      ...(formData.metaData || {}),
      recipientSource: formData.recipientSource || "internal",
      salesforceAccountId:
        formData.recipientSource === "salesforce"
          ? formData.salesforceAccountId
          : undefined,
    },
  };

  if (formData.scheduledAt) {
    const localDate = new Date(formData.scheduledAt);
    submitData.scheduledAt = localDate.toISOString();
  }

  try {
    await onCreate(submitData);

    // reset state
    setFormData({
      campaignName: "",
      surveyId: "",
      channel: "email",
      fallbackChannel: null,
      status: "scheduled",
      channelPriority: [],
      orgId,
      userId,
      recipientSource: "internal",
      contactListId: "",
      salesforceAccountId: "",
      contactFilters: {},
      emailSubject: "",
      emailBodyHtml: "",
      emailFromName: "",
      emailReplyTo: "",
      smsMessage: "",
      whatsappMessage: "",
      whatsappTemplateId: "",
      voiceScript: "",
      scheduledAt: null,
      metaData: {},
    });
    setSelectedContacts([]);
    onClose();
  } catch (error) {
    console.error("Failed to create campaign:", error);
    alert("Failed to create campaign: " + error.message);
  }
};


  if (!isOpen) return null;

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"],
      ["clean"],
    ],
  };

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "link",
  ];
const isInternalSource = formData.recipientSource !== "salesforce";
const hasRecipients =
  isInternalSource
    ? (formData.contactListId || selectedContacts.length > 0)
    : (formData.salesforceAccountId && selectedContacts.length > 0);

  return (
    <div className="fixed inset-0 h-full bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-900">
            Create New Campaign
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.campaignName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      campaignName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Q4 Customer Satisfaction Survey"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Survey *
                </label>
                <select
                  value={formData.surveyId}
                  onChange={async (e) => {
                    const surveyId = e.target.value;
                    setFormData({ ...formData, surveyId });

                    if (surveyId && onLoadSurveyQuestions) {
                      try {
                        await onLoadSurveyQuestions(surveyId);
                      } catch (err) {
                        console.error("Error loading survey questions:", err);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a survey...</option>
                  {surveys.map((survey) => (
                    <option key={survey.survey_id} value={survey.survey_id}>
                      {survey.title ||
                        survey.name ||
                        `Survey ${survey.survey_id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Channel Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Channel Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Channel *
                </label>
                <select
                  value={formData.channel}
                  onChange={(e) =>
                    setFormData({ ...formData, channel: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">📧 Email</option>
                  <option value="sms">💬 SMS</option>
                  <option value="whatsapp">📱 WhatsApp</option>
                  <option value="voice">📞 Voice</option>
                  <option value="multi">🔀 Multi-Channel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fallback Channel
                </label>
                <select
                  value={formData.fallbackChannel || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fallbackChannel: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  <option value="email">📧 Email</option>
                  <option value="sms">💬 SMS</option>
                  <option value="whatsapp">📱 WhatsApp</option>
                  <option value="voice">📞 Voice</option>
                </select>
              </div>
            </div>
          </div>
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Salesforce Accounts
  </label>

  <select
    onChange={async (e) => {
      const accountId = e.target.value;
      if (!accountId) return;

      await listByAccount(accountId);
      setFormData({ ...formData, contactListId: "" });
      setSelectedContacts([]);
      setShowContactSelector(true);
    }}
    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="">Select Salesforce Account...</option>
    {(accounts || []).map((acc) => (
      <option key={acc.
accountId
} value={acc.
accountId
}>
        {acc.name} {acc.industry ? `(${acc.industry})` : ""}
      </option>
    ))}
  </select>
</div>


          <div className="text-center text-gray-500 text-sm">OR</div>

     {/* Recipients Section with Tabs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Recipients *
            </h3>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
            <button
  type="button"
  onClick={() => {
    setFormData({
      ...formData,
      recipientSource: 'internal',
      contactListId: '',
      salesforceAccountId: '',
      contactFilters: {},
    });
    setSelectedContacts([]);
    setShowContactSelector(false);
  }}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  formData.recipientSource === 'internal'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Internal Lists
              </button>
          <button
  type="button"
  onClick={() => {
    setFormData({
      ...formData,
      recipientSource: 'salesforce',
      contactListId: '',
      salesforceAccountId: '',
      contactFilters: {},
    });
    setSelectedContacts([]);
    setShowContactSelector(false);
  }}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  formData.recipientSource === 'salesforce'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                ⚡ Salesforce Accounts
              </button>
            </div>

            {/* Internal Lists Tab */}
            {formData.recipientSource === 'internal' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Contact List
                  </label>
                  <select
                    value={formData.contactListId}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        contactListId: e.target.value,
                      });
                      setSelectedContacts([]);
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a list...</option>
                    {lists.map((list) => (
                      <option key={list.listId} value={list.listId}>
                        {list.name || list.listName} ({list.contacts?.length || 0} contacts)
                      </option>
                    ))}
                  </select>
                </div>

                {formData.contactListId && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <span className="text-lg">✓</span>
                      <span className="font-medium">
                        {lists.find(l => l.listId === formData.contactListId)?.contacts?.length || 0} contacts selected from list
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-center text-gray-500 text-sm">OR</div>

                <button
                  type="button"
                  onClick={() => setShowContactSelector(!showContactSelector)}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                >
                  {selectedContacts.length > 0
                    ? `${selectedContacts.length} individual contacts selected`
                    : 'Select Individual Contacts'}
                </button>
{showContactSelector && (
  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-gray-50">
    <div className="space-y-2">
      {internalContacts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No contacts available
        </p>
      ) : (
        internalContacts.map((contact) => (
          <label
            key={contact.contactId}
            className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedContacts.includes(contact.contactId)}
              onChange={() => toggleContactSelection(contact.contactId)}
              className="w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900">
                {contact.name}
              </div>
              <div className="text-xs text-gray-500">
                {contact.email}
              </div>
            </div>
          </label>
        ))
      )}
    </div>
  </div>
)}

              </div>
            )}

            {/* Salesforce Accounts Tab */}
            {formData.recipientSource === 'salesforce' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Salesforce Account
                  </label>
                  <select
                    value={formData.salesforceAccountId || ''}
                    onChange={async (e) => {
                      const accountId = e.target.value;
                      setFormData({ 
                        ...formData, 
                        salesforceAccountId: accountId,
                        contactListId: '',
                      });
                      setSelectedContacts([]);
                      
                      if (accountId) {
                        try {
                          await listByAccount(accountId);
                        } catch (err) {
                          console.error('Error loading contacts:', err);
                          alert('Failed to load contacts for this account');
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Salesforce Account...</option>
                    {(accounts || []).map((acc) => (
                      <option key={acc.accountId} value={acc.accountId}>
                        {acc.name} {acc.industry ? `(${acc.industry})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

           {formData.salesforceAccountId && sfContacts.length > 0 && (
  <div className="border rounded-lg overflow-hidden bg-gray-50">
    <div className="p-3 bg-blue-50 border-b border-blue-200">
      <div className="flex items-center justify-between">
        <span className="font-medium text-blue-900">
          {sfContacts.length} contacts from Salesforce
        </span>
        <button
          type="button"
          onClick={() => {
            const allIds = sfContacts.map(c => c.contactId);
            if (selectedContacts.length === allIds.length) {
              setSelectedContacts([]);
            } else {
              setSelectedContacts(allIds);
            }
          }}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {selectedContacts.length === sfContacts.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    </div>
    <div className="max-h-60 overflow-y-auto p-2">
      <div className="space-y-2">
        {sfContacts.map((contact) => (
          <label
            key={contact.contactId}
            className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedContacts.includes(contact.contactId)}
              onChange={() => toggleContactSelection(contact.contactId)}
              className="w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <div className="font-medium text-sm text-gray-900">
                {contact.name}
              </div>
              <div className="text-xs text-gray-500">
                {contact.email}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  </div>
)}

{formData.salesforceAccountId && selectedContacts.length > 0 && (
  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
    <div className="flex items-center gap-2 text-green-800">
      <span className="text-lg">✓</span>
      <span className="font-medium">
        {selectedContacts.length} contacts selected from Salesforce
      </span>
    </div>
  </div>
)}

{formData.salesforceAccountId && sfContacts.length === 0 && (
  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
    No contacts found for this Salesforce account
  </div>
)}


                {formData.salesforceAccountId && selectedContacts.length > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <span className="text-lg">✓</span>
                      <span className="font-medium">
                        {selectedContacts.length} contacts selected from Salesforce
                      </span>
                    </div>
                  </div>
                )}

                {formData.salesforceAccountId && contacts.length === 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                    No contacts found for this Salesforce account
                  </div>
                )}
              </div>
            )}
          </div>
          {/* EMAIL CONFIG */}
          {(formData.channel === "email" ||
            formData.channel === "multi") && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">
                📧 Email Configuration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={formData.emailFromName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emailFromName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Company"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={formData.emailReplyTo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emailReplyTo: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="reply@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={formData.emailSubject}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emailSubject: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="We'd love your feedback!"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Email Body (HTML)
                </label>

                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={insertSurveyLink}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    🔗 Insert Survey Link
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQuestionPicker(true)}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                  >
                    🎯 Embed Survey Question
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setShowVariableMenu((prev) => !prev)
                      }
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                    >
                      + Add Variable
                    </button>

                    {showVariableMenu && (
                      <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 w-64">
                        <div className="p-2 max-h-64 overflow-y-auto">
                          <div className="text-xs font-semibold text-gray-500 px-2 py-1">
                            Contact Info
                          </div>
                          {[
                            "{{name}}",
                            "{{email}}",
                            "{{contact_id}}",
                            "{{phone}}",
                          ].map((tok) => (
                            <button
                              key={tok}
                              onClick={() => insertVariable(tok)}
                              className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
                            >
                              {tok}
                            </button>
                          ))}

                          <div className="text-xs font-semibold text-gray-500 px-2 py-1 mt-2">
                            Campaign Info
                          </div>
                          {[
                            "{{campaign_id}}",
                            "{{campaign_name}}",
                            "{{survey_id}}",
                            "{{org_id}}",
                            "{{user_id}}",
                            "{{tracking_token}}",
                          ].map((tok) => (
                            <button
                              key={tok}
                              onClick={() => insertVariable(tok)}
                              className="w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
                            >
                              {tok}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border rounded-lg overflow-hidden">
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={formData.emailBodyHtml}
                    onChange={handleQuillChange}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Hi {{name}},&#10;&#10;We'd love to hear your feedback..."
                  />
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  Content is stored as HTML; tokens like <code>{"{{name}}"}</code>{" "}
                  and buttons / links will be preserved.
                </p>
              </div>
            </div>
          )}

          {/* SMS CONFIG */}
          {(formData.channel === "sms" ||
            formData.channel === "multi") && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">
                💬 SMS Configuration
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMS Message
                </label>
                <textarea
                  value={formData.smsMessage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      smsMessage: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Hi {{name}}, please take our quick survey: {{survey_link}}"
                  maxLength={160}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.smsMessage.length}/160 characters
                </p>
              </div>
            </div>
          )}

          {/* Scheduling */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Scheduling (Optional)
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send When?
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Now", value: null },
                  { label: "10 mins", v: 10, u: "minutes" },
                  { label: "30 mins", v: 30, u: "minutes" },
                  { label: "1 hour", v: 1, u: "hours" },
                  { label: "7 hours", v: 7, u: "hours" },
                  { label: "1 day", v: 1, u: "days" },
                  { label: "1 week", v: 1, u: "weeks" },
                  { label: "1 month", v: 1, u: "months" },
                ].map((opt, i) => (
                  <button
                    key={i}
                    className={`px-3 py-1.5 text-sm rounded border ${
                      formData.scheduledAt === null && opt.value === null
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                    }`}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        scheduledAt: opt.value === null ? null : addTime(opt.v, opt.u),
                      }));
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Pick a Custom Time
                <span className="text-xs text-gray-500 ml-2">
                  (Your timezone: {getUserTimezone()})
                </span>
              </label>

              <input
                type="datetime-local"
                value={
                  formData.scheduledAt
                    ? new Date(formData.scheduledAt)
                        .toLocaleString("sv-SE")
                        .replace(" ", "T")
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) => {
                  const local = e.target.value;
                  if (!local) {
                    setFormData({ ...formData, scheduledAt: null });
                    return;
                  }
                  const utc = new Date(local).toISOString();
                  setFormData({ ...formData, scheduledAt: utc });
                }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between rounded-b-lg">
          <div className="text-sm text-gray-600 space-x-3">
            {formData.contactListId && <span>📋 Using list</span>}
            {selectedContacts.length > 0 && (
              <span>👥 {selectedContacts.length} contacts selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
  <button
  type="button"
  onClick={handleSubmit}
  disabled={
    !formData.campaignName ||
    !formData.surveyId ||
    !hasRecipients
  }
  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  Create Campaign
</button>

          </div>
        </div>
      </div>

      {/* Question Picker Modal */}
      {showQuestionPicker && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 relative">
            <button
              onClick={() => setShowQuestionPicker(false)}
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-900"
            >
              ✖
            </button>

            <h3 className="text-lg font-semibold mb-3">
              Embed a Survey Question
            </h3>

            {!formData.surveyId ? (
              <p className="text-sm text-amber-600">
                Please select a survey first.
              </p>
            ) : surveyQuestions.length === 0 ? (
              <p className="text-sm text-gray-600">
                No questions available on this object.
                You can attach questions to the survey object or fetch them
                when survey changes.
              </p>
            ) : (
              <>
                <label className="block text-sm mb-2">Select Question</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mb-4 text-sm"
                  value={pickerQuestionId}
                  onChange={(e) => setPickerQuestionId(e.target.value)}
                >
                  <option value="">Choose question...</option>
                  {surveyQuestions.map((q) => (
                    <option
                      key={q.question_id || q.questionId}
                      value={q.question_id || q.questionId}
                    >
                      {q.label ||
                        q.description ||
                        q.questionText ||
                        (q.type || "Question")}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-gray-500 mb-3">
                  We will embed this as 1-click answer buttons.
                  Clicking an option opens the survey with that answer
                  pre-filled.
                </p>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowQuestionPicker(false)}
                    className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={embedSelectedQuestion}
                    className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    Embed Question
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignCreateModal;