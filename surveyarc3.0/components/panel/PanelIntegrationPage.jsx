"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useParticipantSources } from "@/providers/postGresPorviders/participantSourcePProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import PanelOverview from "@/components/panel/PanelOverview";

const PROVIDER_TEMPLATES = [
  { id: "dynata", label: "Dynata", icon: "🔷" },
  { id: "cint", label: "Cint", icon: "🟢" },
  { id: "lucid", label: "Lucid", icon: "🟣" },
  { id: "azure", label: "Azure", icon: "🔵" },
  { id: "custom_external", label: "Custom External Panel", icon: "⚙️" },
  { id: "file", label: "CSV / File Upload", icon: "📁" },
];

function buildTemplateConfig(templateId, orgId, surveyId) {
  const base = {
    source_name: "",
    source_type: "external",
    description: "",
    is_active: true,
    expected_completes: "",
    expected_incidence_rate: "",
    url_variables: [],
    meta_data: { provider: templateId },
    exit_defaults: {
      qualified: "",
      terminated: "",
      quota_full: "",
    },
  };

  switch (templateId) {
    case "dynata":
      return {
        ...base,
        source_name: "Dynata",
        source_type: "internal",
        description: "Dynata / SSI programmatic panel",
        url_variables: [
          {
            var_name: "psid",
            required: "unique",
            authentication: "no_authentication",
            description: "Dynata respondent ID (psid, unique per respondent)",
            default_value: null,
            validation_regex: null,
          },
        ],
        meta_data: {
          provider: "dynata",
          docs_url: "https://www.dynata.com/",
          required_params: ["psid"],
        },
        exit_defaults: {
          qualified: "https://dkr1.ssisurveys.com/projects/end?rst=1&psid=${psid}&_d=${gv.survey.path}",
          terminated: "https://dkr1.ssisurveys.com/projects/end?rst=2&psid=${psid}&_d=${gv.survey.path}",
          quota_full: "https://dkr1.ssisurveys.com/projects/end?rst=3&psid=${psid}&_d=${gv.survey.path}",
        },
      };

    case "cint":
      return {
        ...base,
        source_name: "Cint",
        source_type: "internal",
        description: "Cint panel integration",
        url_variables: [],
        meta_data: { provider: "cint", docs_url: "https://cint.com/" },
        exit_defaults: {
          terminated: "https://s.cint.com/Survey/EarlyScreenOut",
          quota_full: "https://s.cint.com/Survey/QuotaFull",
          qualified: "https://s.cint.com/Survey/Complete",
        },
      };

    case "lucid":
      return {
        ...base,
        source_name: "Lucid",
        source_type: "internal",
        description: "Lucid panel integration",
        url_variables: [
          {
            var_name: "PID",
            required: "unique",
            authentication: "no_authentication",
            description: "Lucid participant ID",
            default_value: null,
            validation_regex: null,
          },
        ],
        meta_data: { provider: "lucid", docs_url: "https://luc.id/" },
        exit_defaults: {
          qualified: "https://www.samplicio.us/router/ClientSurveyFinish.aspx?psid=[%PID%]",
          terminated: "https://www.samplicio.us/router/ClientSurveyScreenout.aspx?psid=[%PID%]",
          quota_full: "https://www.samplicio.us/router/ClientSurveyQuotaFull.aspx?psid=[%PID%]",
        },
      };

    case "azure":
      return {
        ...base,
        source_name: "Azure",
        source_type: "internal",
        description: "Azure / Xurway style integration",
        url_variables: [
          {
            var_name: "trans_id",
            required: "unique",
            authentication: "no_authentication",
            description: "Transaction ID (unique per respondent)",
            default_value: null,
            validation_regex: null,
          },
          {
            var_name: "projectid",
            required: "required",
            authentication: "no_authentication",
            description: "Panel project id",
            default_value: null,
            validation_regex: null,
          },
        ],
        meta_data: {
          provider: "azure",
          docs_url: "https://host1.xurway.com/",
          required_params: ["trans_id", "projectid"],
        },
        exit_defaults: {
          terminated: "https://host1.xurway.com/StaticRedirect/client_page.asp?trans_id=${trans_id}&s=2&projectid=${projectid}",
          quota_full: "https://host1.xurway.com/StaticRedirect/client_page.asp?trans_id=${trans_id}&s=3&projectid=${projectid}",
          qualified: "https://host1.xurway.com/StaticRedirect/client_page.asp?trans_id=${trans_id}&s=1&projectid=${projectid}",
        },
      };

    case "file":
      return {
        ...base,
        source_name: "File / CSV Upload",
        source_type: "file",
        description: "Static list via CSV/Excel upload",
        url_variables: [],
        meta_data: { provider: "file" },
        exit_defaults: { qualified: "", terminated: "", quota_full: "" },
      };

    case "custom_external":
    default:
      return {
        ...base,
        source_name: "Custom External Panel",
        source_type: "external",
        description: "Custom external partner integration",
        url_variables: [],
        meta_data: { provider: "custom_external" },
        exit_defaults: {
          qualified: "https://PARTNER_COMPLETE_URL?status=complete&rid={respondent_id}",
          terminated: "https://PARTNER_TERMINATE_URL?status=terminate&rid={respondent_id}",
          quota_full: "https://PARTNER_QUOTAFULL_URL?status=quotafull&rid={respondent_id}",
        },
      };
  }
}

export default function PanelIntegrationPage() {
  const pathname = usePathname();
  const { sources, loading, createSource, updateSource } = useParticipantSources();
  const surveyId = pathname.split("/")[7]
  const orgId = pathname.split("/")[3]
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [providerTemplate, setProviderTemplate] = useState("dynata");
  const [form, setForm] = useState({
    source_name: "",
    source_type: "internal",
    description: "",
    is_active: true,
    expected_completes: "",
    expected_incidence_rate: "",
    url_variables: [],
    meta_data: {},
  });

  const [customExitPages, setCustomExitPages] = useState([]);
  const [standardExits, setStandardExits] = useState({
    terminated: "",
    quota_full: "",
    qualified: "",
  });

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Load existing panel data
  useEffect(() => {
    if (!selectedSourceId) return;
    const src = sources.find((s) => s.id === selectedSourceId);
    if (!src) return;

    const providerValue = src.meta_data?.provider || "custom_external";
    setProviderTemplate(providerValue);
    setShowTemplateSelector(false);

    setForm({
      source_name: src.source_name,
      source_type: src.source_type,
      description: src.description || "",
      is_active: src.is_active,
      expected_completes: src.expected_completes ?? "",
      expected_incidence_rate: src.expected_incidence_rate ?? "",
      url_variables: src.url_variables || [],
      meta_data: src.meta_data || {},
    });

    const exits = src.exit_pages || {};
    setStandardExits({
      terminated: exits.terminated?.redirect_url || "",
      quota_full: exits.quota_full?.redirect_url || "",
      qualified: exits.qualified?.redirect_url || "",
    });

    const custom = Object.entries(exits)
      .filter(([key]) => !["terminated", "quota_full", "qualified"].includes(key))
      .map(([key, value]) => ({
        id: key,
        condition: value.conditions?.[0] || {},
        redirect_url: value.redirect_url || "",
      }));
    setCustomExitPages(custom);
  }, [selectedSourceId, sources]);

  // Apply template defaults for new panels
  useEffect(() => {
    if (selectedSourceId) return;
    if (!orgId || !surveyId) return;

    const tpl = buildTemplateConfig(providerTemplate, orgId, surveyId);

    setForm((prev) => {
      const shouldUpdateName = !prev.source_name || 
        PROVIDER_TEMPLATES.some(p => prev.source_name === p.label);
      
      return {
        source_name: shouldUpdateName ? tpl.source_name : prev.source_name,
        source_type: tpl.source_type,
        description: shouldUpdateName ? tpl.description : prev.description,
        is_active: true,
        expected_completes: prev.expected_completes || tpl.expected_completes,
        expected_incidence_rate: prev.expected_incidence_rate || tpl.expected_incidence_rate,
        url_variables: tpl.url_variables,
        meta_data: tpl.meta_data,
      };
    });

    setStandardExits({
      terminated: tpl.exit_defaults.terminated || "",
      quota_full: tpl.exit_defaults.quota_full || "",
      qualified: tpl.exit_defaults.qualified || "",
    });
    setCustomExitPages([]);
  }, [providerTemplate, surveyId, selectedSourceId]);

  const onChangeBasic = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateUrlVariable = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      url_variables: prev.url_variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };
  const primaryVar = useMemo(() => {
    // pick first required/unique URL variable (psid, PID, trans_id, etc.)
    return form.url_variables?.find(
      (v) => v.required === "unique" || v.required === "required"
    );
  }, [form.url_variables]);

  const panelEntryUrl = useMemo(() => {
    if (!origin || !orgId || !surveyId) return "";

    // If editing an existing source, use selectedSourceId.
    // If creating a new one, there is no id yet, so we don’t put source_id.
    const sourceIdPart = selectedSourceId
      ? `&source_id=${selectedSourceId}`
      : "";

    // e.g. psid, PID, trans_id...
    const varPart = primaryVar?.var_name
      ? `&${primaryVar.var_name}={${primaryVar.var_name}}`
      : "";

    return `${origin}/form?org_id=${orgId}&survey_id=${surveyId}${sourceIdPart}${varPart}`;
  }, [origin, orgId, surveyId, selectedSourceId, primaryVar]);

  const addUrlVariable = () => {
    setForm((prev) => ({
      ...prev,
      url_variables: [
        ...prev.url_variables,
        {
          var_name: "",
          required: "optional",
          authentication: "no_authentication",
          description: "",
          default_value: null,
          validation_regex: null,
        },
      ],
    }));
  };

  const removeUrlVariable = (index) => {
    setForm((prev) => ({
      ...prev,
      url_variables: prev.url_variables.filter((_, i) => i !== index),
    }));
  };

  const addCustomExitPage = () => {
    setCustomExitPages([
      ...customExitPages,
      {
        id: `custom_${Date.now()}`,
        condition: { type: "terminated", marker: "" },
        redirect_url: "",
      },
    ]);
  };

  const updateCustomExitPage = (index, field, value) => {
    setCustomExitPages(
      customExitPages.map((page, i) =>
        i === index ? { ...page, [field]: value } : page
      )
    );
  };

  const removeCustomExitPage = (index) => {
    setCustomExitPages(customExitPages.filter((_, i) => i !== index));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!orgId || !surveyId) {
      console.log("Missing org or survey context",surveyId,orgId)
      alert("Missing org or survey context",surveyId,orgId);
      return;
    }

    const exit_pages = {};

    if (standardExits.terminated) {
      exit_pages.terminated = {
        exit_type: "redirect",
        redirect_url: standardExits.terminated,
        message_title: null,
        message_body: null,
        url_params: {},
        conditions: [],
      };
    }

    if (standardExits.quota_full) {
      exit_pages.quota_full = {
        exit_type: "redirect",
        redirect_url: standardExits.quota_full,
        message_title: null,
        message_body: null,
        url_params: {},
        conditions: [],
      };
    }

    if (standardExits.qualified) {
      exit_pages.qualified = {
        exit_type: "redirect",
        redirect_url: standardExits.qualified,
        message_title: null,
        message_body: null,
        url_params: {},
        conditions: [],
      };
    }

    customExitPages.forEach((page) => {
      if (page.redirect_url) {
        exit_pages[page.id] = {
          exit_type: "redirect",
          redirect_url: page.redirect_url,
          message_title: null,
          message_body: null,
          url_params: {},
          conditions: [page.condition],
        };
      }
    });

    const payload = {
      org_id: orgId,
      survey_id: surveyId,
      source_name: form.source_name.trim(),
      source_type: form.source_type,
      description: form.description || null,
      is_active: form.is_active,
      expected_completes: form.expected_completes ? Number(form.expected_completes) : null,
      expected_incidence_rate: form.expected_incidence_rate ? Number(form.expected_incidence_rate) : null,
      url_variables: form.url_variables || [],
      meta_data: { ...(form.meta_data || {}), provider: providerTemplate },
      exit_pages,
    };

    try {
      if (selectedSourceId) {
        await updateSource(selectedSourceId, payload);
        alert("Panel updated");
      } else {
        const created = await createSource(payload);
        setSelectedSourceId(created.id);
        setShowTemplateSelector(false);
        alert("Panel created");
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to save panel");
    }
  };

  const handleNewPanel = () => {
    setSelectedSourceId(null);
    setShowTemplateSelector(true);
    setProviderTemplate("dynata");
    
    const tpl = buildTemplateConfig("dynata", orgId, surveyId);
    
    setForm({
      source_name: tpl.source_name,
      source_type: tpl.source_type,
      description: tpl.description,
      is_active: true,
      expected_completes: "",
      expected_incidence_rate: "",
      url_variables: tpl.url_variables,
      meta_data: tpl.meta_data,
    });
    
    setStandardExits({
      terminated: tpl.exit_defaults.terminated || "",
      quota_full: tpl.exit_defaults.quota_full || "",
      qualified: tpl.exit_defaults.qualified || "",
    });
    setCustomExitPages([]);
  };

  const selectTemplate = (templateId) => {
    setProviderTemplate(templateId);
    setShowTemplateSelector(false);
    
    const tpl = buildTemplateConfig(templateId, orgId, surveyId);
    
    setForm({
      source_name: tpl.source_name,
      source_type: tpl.source_type,
      description: tpl.description,
      is_active: true,
      expected_completes: "",
      expected_incidence_rate: "",
      url_variables: tpl.url_variables,
      meta_data: tpl.meta_data,
    });
    
    setStandardExits({
      terminated: tpl.exit_defaults.terminated || "",
      quota_full: tpl.exit_defaults.quota_full || "",
      qualified: tpl.exit_defaults.qualified || "",
    });
    setCustomExitPages([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Panel / Participant Sources</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure panel integrations with pre-filled templates for major providers.
          </p>
        </div>
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                  Survey Elements
                </h2>
              </div>
              
              <div className="p-2">
                <div className="mb-2 px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Participant Sources
                </div>
                
                {sources.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-500">No panels yet</p>
                ) : (
                  <ul className="space-y-1">
                    {sources.map((src) => (
                      <li
                        key={src.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm ${
                          selectedSourceId === src.id
                            ? "bg-blue-600 text-white"
                            : "hover:bg-gray-100 text-gray-700"
                        }`}
                        onClick={() => setSelectedSourceId(src.id)}
                      >
                        <span className="text-xs">👥</span>
                        <span className="truncate">{src.source_name}</span>
                      </li>
                    ))}
                  </ul>
                )}
                
                <button
                  onClick={handleNewPanel}
                  className="w-full mt-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded border-2 border-dashed border-gray-300"
                >
                  + New Panel
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {showTemplateSelector && !selectedSourceId ? (
              /* Template Selector */
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Choose Panel Provider</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Select a provider to auto-configure URLs and parameters
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {PROVIDER_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => selectTemplate(template.id)}
                      className="flex items-center gap-4 p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <span className="text-4xl">{template.icon}</span>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 group-hover:text-blue-600">
                          {template.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {template.id === "dynata" && "SSI / Dynata panel with psid"}
                          {template.id === "cint" && "Cint panel integration"}
                          {template.id === "lucid" && "Lucid Marketplace with PID"}
                          {template.id === "azure" && "Azure / Xurway with trans_id"}
                          {template.id === "file" && "Upload CSV/Excel respondent list"}
                          {template.id === "custom_external" && "Custom partner configuration"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Configuration Form */
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="bg-blue-800 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Participant Source</h2>
                  {!selectedSourceId && (
                    <button
                      type="button"
                      onClick={() => setShowTemplateSelector(true)}
                      className="text-sm text-blue-100 hover:text-white underline"
                    >
                      Change Provider
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-b-lg border border-gray-200 p-6 space-y-6">
                  {/* Provider Badge */}
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                    <span className="text-2xl">
                      {PROVIDER_TEMPLATES.find(t => t.id === providerTemplate)?.icon}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {PROVIDER_TEMPLATES.find(t => t.id === providerTemplate)?.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        Provider template with pre-configured defaults
                      </div>
                    </div>
                  </div>
                  {/* Panel Entry URL (Send this to provider) */}
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                      Panel Entry URL
                    </label>
                    <p className="text-[11px] text-gray-500 mb-2">
                      Share this URL with the panel provider. They will replace{" "}
                      <code className="px-1 py-0.5 bg-gray-100 rounded">
                        {"{"+(primaryVar?.var_name || "id")+"}"}
                      </code>{" "}
                      with their respondent ID.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={panelEntryUrl || "Fill & save panel to generate URL"}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-xs bg-gray-50 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!panelEntryUrl) return;
                          navigator.clipboard.writeText(panelEntryUrl).then(
                            () => alert("Panel URL copied"),
                            () => alert("Failed to copy")
                          );
                        }}
                        className="px-3 py-2 text-xs bg-gray-800 text-white rounded hover:bg-gray-900"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Participant Source Name
                    </label>
                    <input
                      type="text"
                      value={form.source_name}
                      onChange={(e) => onChangeBasic("source_name", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* URL Variables */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">URL Variables</h3>
                    
                    {form.url_variables.length === 0 ? (
                      <p className="text-sm text-gray-500 mb-3">No extra variables added.</p>
                    ) : (
                      <div className="mb-4 border border-gray-200 rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Var Name</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Required</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Authentication</th>
                              <th className="px-4 py-2 w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.url_variables.map((v, idx) => (
                              <tr key={idx} className="border-b border-gray-100 last:border-0">
                                <td className="px-4 py-3">
                                  <input
                                    type="text"
                                    value={v.var_name}
                                    onChange={(e) => updateUrlVariable(idx, "var_name", e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="variable_name"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={v.required}
                                    onChange={(e) => updateUrlVariable(idx, "required", e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="unique">Unique</option>
                                    <option value="required">Required</option>
                                    <option value="optional">Optional</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={v.authentication}
                                    onChange={(e) => updateUrlVariable(idx, "authentication", e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="no_authentication">No Authentication</option>
                                    <option value="basic">Basic</option>
                                    <option value="token">Token</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeUrlVariable(idx)}
                                    className="text-gray-400 hover:text-red-600"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={addUrlVariable}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Variable
                    </button>
                  </div>

                  {/* Exit Pages */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Exit Pages</h3>
                    
                    <button
                      type="button"
                      onClick={addCustomExitPage}
                      className="mb-4 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                    >
                      + Add Custom Exit Page
                    </button>

                    <div className="space-y-6">
                      {/* Custom Exit Pages */}
                      {customExitPages.map((page, idx) => (
                        <div key={idx} className="border-l-4 border-gray-300 pl-4">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-medium text-gray-600">Custom Exit Page</span>
                            <button
                              type="button"
                              onClick={() => removeCustomExitPage(idx)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              ✕
                            </button>
                          </div>
                          
                          <div className="mb-3 flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Show If:</span>
                            <select
                              value={page.condition.type}
                              onChange={(e) => updateCustomExitPage(idx, "condition", { ...page.condition, type: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="terminated">Terminated</option>
                              <option value="qualified">Qualified</option>
                              <option value="quota_full">Quota Full</option>
                            </select>
                            <span className="text-gray-600">AND</span>
                            <input
                              type="text"
                              value={page.condition.marker || ""}
                              onChange={(e) => updateCustomExitPage(idx, "condition", { ...page.condition, marker: e.target.value })}
                              placeholder='hasMarker("marker_name")'
                              className="flex-1 px-2 py-1 border border-gray-300 rounded"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 w-20">Redirect</span>
                            <input
                              type="url"
                              value={page.redirect_url}
                              onChange={(e) => updateCustomExitPage(idx, "redirect_url", e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      ))}

                      {/* Standard Exit Pages */}
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm font-medium text-gray-700 w-48">Terminated Participants</span>
                          <input
                            type="url"
                            value={standardExits.terminated}
                            onChange={(e) => setStandardExits({ ...standardExits, terminated: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm font-medium text-gray-700 w-48">Over-Quota Participants</span>
                          <input
                            type="url"
                            value={standardExits.quota_full}
                            onChange={(e) => setStandardExits({ ...standardExits, quota_full: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700 w-48">Qualified Participants</span>
                          <input
                            type="url"
                            value={standardExits.qualified}
                            onChange={(e) => setStandardExits({ ...standardExits, qualified: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                    >
                      {selectedSourceId ? "Save Changes" : "Create Panel"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}