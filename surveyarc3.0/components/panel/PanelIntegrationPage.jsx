"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useParticipantSources } from "@/providers/postGresPorviders/participantSourcePProvider";
import { buildTemplateConfig } from "@/utils/buildTemplateConfig";
import { PROVIDER_TEMPLATES, TEMPLATE_CATEGORIES, CATEGORY_LABELS } from "@/utils/providerTemplates";

export default function PanelIntegrationPage({ sourceId = null, onClose = null }) {
  const pathname = usePathname();
  const { sources, loading, createSource, updateSource } = useParticipantSources();
  const surveyId = pathname.split("/")[7];
  const orgId = pathname.split("/")[3];
  
  const [selectedSourceId, setSelectedSourceId] = useState(sourceId);
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Load existing panel data
  useEffect(() => {
    if (!selectedSourceId) return;
    const src = sources.find((s) => s.id === selectedSourceId);
    if (!src) return;

    setProviderTemplate(src.meta_data?.provider || "custom_external");
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

  // Apply template defaults
  useEffect(() => {
    if (selectedSourceId || !orgId || !surveyId) return;

    const tpl = buildTemplateConfig(providerTemplate, orgId, surveyId);
    setForm((prev) => ({
      source_name: !prev.source_name || PROVIDER_TEMPLATES.some(p => prev.source_name === p.label) ? tpl.source_name : prev.source_name,
      source_type: tpl.source_type,
      description: !prev.source_name || PROVIDER_TEMPLATES.some(p => prev.source_name === p.label) ? tpl.description : prev.description,
      is_active: true,
      expected_completes: prev.expected_completes || tpl.expected_completes,
      expected_incidence_rate: prev.expected_incidence_rate || tpl.expected_incidence_rate,
      url_variables: tpl.url_variables,
      meta_data: tpl.meta_data,
    }));

    setStandardExits({
      terminated: tpl.exit_defaults.terminated || "",
      quota_full: tpl.exit_defaults.quota_full || "",
      qualified: tpl.exit_defaults.qualified || "",
    });
    setCustomExitPages([]);
  }, [providerTemplate, surveyId, orgId, selectedSourceId]);

  const updateUrlVariable = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      url_variables: prev.url_variables.map((v, i) => i === index ? { ...v, [field]: value } : v),
    }));
  };

  // Get fixed variables from panel redirects with usage info
  const getFixedVariablesFromRedirects = () => {
    const fixedVarsMap = new Map();
    
    // Extract from standard exits
    Object.entries(standardExits).forEach(([exitType, url]) => {
      if (url) {
        const matches = url.matchAll(/\$\{([^}]+)\}/g);
        for (const match of matches) {
          const varName = match[1];
          if (!fixedVarsMap.has(varName)) {
            fixedVarsMap.set(varName, { name: varName, usedIn: [] });
          }
          fixedVarsMap.get(varName).usedIn.push(exitType);
        }
      }
    });
    
    // Extract from custom exits
    customExitPages.forEach((page, idx) => {
      if (page.redirect_url) {
        const matches = page.redirect_url.matchAll(/\$\{([^}]+)\}/g);
        for (const match of matches) {
          const varName = match[1];
          if (!fixedVarsMap.has(varName)) {
            fixedVarsMap.set(varName, { name: varName, usedIn: [] });
          }
          fixedVarsMap.get(varName).usedIn.push(`custom_${idx + 1}`);
        }
      }
    });
    
    return Array.from(fixedVarsMap.values());
  };

  const panelEntryUrl = useMemo(() => {
    if (!origin || !orgId || !surveyId) return "";
    const sourceIdPart = selectedSourceId ? `&source_id=${selectedSourceId}` : "";
    
    // Use var_name (custom name) in URL
    const allVarParts = form.url_variables
      .filter(v => v.var_name)
      .map(v => {
        const displayName = v.var_name;
        const value = v.var_value || `{${displayName}}`;
        return `&${displayName}=${value}`;
      })
      .join("");
      
    return `${origin}/form?org_id=${orgId}&survey_id=${surveyId}${sourceIdPart}${allVarParts}`;
  }, [origin, orgId, surveyId, selectedSourceId, form.url_variables]);

  const addUrlVariable = () => {
    setForm((prev) => ({
      ...prev,
      url_variables: [...prev.url_variables, {
        var_name: "",
        var_value: "",
        required: "optional",
        authentication: "no_authentication",
        description: "",
        default_value: null,
        validation_regex: null,
        mapped_to: null,
      }],
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!orgId || !surveyId) return alert("Missing org/survey context");

    setIsSaving(true);

    const exit_pages = {};
    ["terminated", "quota_full", "qualified"].forEach(key => {
      if (standardExits[key]) {
        exit_pages[key] = {
          exit_type: "redirect",
          redirect_url: standardExits[key],
          message_title: null,
          message_body: null,
          url_params: {},
          conditions: [],
        };
      }
    });

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

    console.log("💾 Saving Panel with Payload:", JSON.stringify(payload, null, 2));

    try {
      if (selectedSourceId) {
        await updateSource(selectedSourceId, payload);
        alert("Panel updated!");
      } else {
        const created = await createSource(payload);
        setSelectedSourceId(created.id);
        setShowTemplateSelector(false);
        alert("Panel created!");
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
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

  const btnClass = "px-4 py-2 rounded font-medium";
  const inputClass = "w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500";

  // Get available fixed variables for mapping
  const fixedVariablesWithUsage = getFixedVariablesFromRedirects();

  return (
    <div className="fixed inset-0 bg-black/40 p-6 overflow-y-auto z-50">
      <div className="max-w-7xl mx-auto py-8">
        <div className="bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="border-b px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Panel Integration</h1>
              <p className="text-sm text-gray-600">Configure panel provider integrations</p>
            </div>
            <div className="flex gap-2">
              {!showTemplateSelector && !selectedSourceId && (
                <button onClick={() => setShowTemplateSelector(true)} className={`${btnClass} bg-blue-600 text-white`}>
                  + New Panel
                </button>
              )}
              {onClose && <button onClick={onClose} className={`${btnClass} border`}>Close</button>}
            </div>
          </div>

          <div className="p-6">
            {showTemplateSelector && !selectedSourceId ? (
              /* Template Selector */
              <div>
                <h2 className="text-xl font-bold mb-4">Choose Panel Provider</h2>
                {Object.entries(TEMPLATE_CATEGORIES).map(([category, templateIds]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase">{CATEGORY_LABELS[category]}</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {templateIds.map((templateId) => {
                        const template = PROVIDER_TEMPLATES.find(t => t.id === templateId);
                        return (
                          <button key={template.id} onClick={() => selectTemplate(template.id)} 
                            className="flex items-center gap-3 p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left">
                            <span className="text-2xl">{template.icon}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{template.label}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Configuration Form */
              <form onSubmit={onSubmit} className="space-y-6">
                {/* Provider Header */}
                <div className="bg-blue-600 text-white px-5 py-4 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{PROVIDER_TEMPLATES.find(t => t.id === providerTemplate)?.icon}</span>
                    <div>
                      <h2 className="font-bold">{PROVIDER_TEMPLATES.find(t => t.id === providerTemplate)?.label}</h2>
                      <p className="text-sm text-blue-100">Pre-configured template</p>
                    </div>
                  </div>
                  {!selectedSourceId && (
                    <button type="button" onClick={() => setShowTemplateSelector(true)} 
                      className="text-sm underline hover:text-blue-100">
                      Change Provider
                    </button>
                  )}
                </div>

             

                {/* Basic Info */}
                <div className="border rounded p-4">
                  <h3 className="font-bold mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block font-medium mb-1">Panel Name *</label>
                      <input type="text" value={form.source_name} onChange={(e) => setForm(p => ({...p, source_name: e.target.value}))} 
                        className={inputClass} required />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Description</label>
                      <textarea value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))} 
                        className={inputClass} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block font-medium mb-1">Expected Completes</label>
                        <input type="number" value={form.expected_completes} onChange={(e) => setForm(p => ({...p, expected_completes: e.target.value}))} 
                          className={inputClass} min="0" />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">Incidence Rate (%)</label>
                        <input type="number" value={form.expected_incidence_rate} onChange={(e) => setForm(p => ({...p, expected_incidence_rate: e.target.value}))} 
                          className={inputClass} min="0" max="100" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.is_active} onChange={(e) => setForm(p => ({...p, is_active: e.target.checked}))} />
                      <span className="text-sm">Panel is active</span>
                    </label>
                  </div>
                </div>

                {/* Variable Mapping Helper */}
                {fixedVariablesWithUsage.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-4">
                    <h3 className="font-bold text-purple-900 mb-2">📋 Panel Variables Found in Redirect URLs</h3>
                    <p className="text-sm text-purple-700 mb-3">
                      These variables are used in your panel's redirect URLs. Map your custom variable names to these below.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {fixedVariablesWithUsage.map((varInfo) => (
                        <div key={varInfo.name} className="bg-white border border-purple-300 rounded p-3">
                          <div className="font-mono font-bold text-purple-900 mb-1">${varInfo.name}</div>
                          <div className="text-xs text-gray-600">
                            Used in: {varInfo.usedIn.map(u => u.replace('_', ' ')).join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* URL Variables */}
                <div className="border rounded p-4">
                  <div className="flex justify-between mb-4">
                    <div>
                      <h3 className="font-bold">URL Variables Mapping</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Create your custom variable names and map them to the panel's fixed variables shown above
                      </p>
                    </div>
                    <button type="button" onClick={addUrlVariable} className={`${btnClass} bg-gray-100 text-sm`}>
                      + Add Variable
                    </button>
                  </div>
                  {form.url_variables.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No variables configured. Click "+ Add Variable" to start.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Your Custom Name</th>
                            <th className="px-3 py-2 text-left">➜ Maps To Panel Variable</th>
                            <th className="px-3 py-2 text-left">Default Value</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-left">Required</th>
                            <th className="px-3 py-2 text-left">Auth</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.url_variables.map((v, idx) => {
                            // Find which redirects use the mapped variable
                            const usedInRedirects = [];
                            const mappedVar = v.mapped_to || v.var_name;
                            
                            Object.entries(standardExits).forEach(([exitType, url]) => {
                              if (url && mappedVar && url.includes(`\${${mappedVar}}`)) {
                                usedInRedirects.push(exitType.replace('_', ' '));
                              }
                            });
                            
                            customExitPages.forEach((page, pageIdx) => {
                              if (page.redirect_url && mappedVar && page.redirect_url.includes(`\${${mappedVar}}`)) {
                                usedInRedirects.push(`custom ${pageIdx + 1}`);
                              }
                            });
                            
                            const isMapped = v.mapped_to && v.mapped_to !== v.var_name;
                            const isUsed = usedInRedirects.length > 0;
                            
                            return (
                              <tr key={idx} className="border-t hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <input 
                                    type="text" 
                                    value={v.var_name} 
                                    onChange={(e) => updateUrlVariable(idx, "var_name", e.target.value)} 
                                    className="w-full px-2 py-1 border rounded text-sm font-mono bg-green-50" 
                                    placeholder="user_id" 
                                  />
                                  <div className="text-xs text-gray-500 mt-1">In survey URL</div>
                                </td>
                                <td className="px-3 py-2">
                                  <select 
                                    value={v.mapped_to || ""} 
                                    onChange={(e) => updateUrlVariable(idx, "mapped_to", e.target.value || null)}
                                    className={`w-full px-2 py-1 border rounded text-sm font-mono ${isMapped ? 'bg-blue-100 border-blue-400' : 'bg-white'}`}
                                  >
                                    <option value="">-- Same as custom name --</option>
                                    {fixedVariablesWithUsage.map(varInfo => (
                                      <option key={varInfo.name} value={varInfo.name}>
                                        {varInfo.name} (used in: {varInfo.usedIn.map(u => u.replace('_', ' ')).join(', ')})
                                      </option>
                                    ))}
                                  </select>
                                  {isMapped && (
                                    <div className="flex items-center gap-1 mt-1 text-xs">
                                      <span className="text-green-600 font-mono">{v.var_name}</span>
                                      <span className="text-blue-600">→</span>
                                      <span className="text-blue-600 font-mono">{v.mapped_to}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <input 
                                    type="text" 
                                    value={v.var_value || ""} 
                                    onChange={(e) => updateUrlVariable(idx, "var_value", e.target.value)} 
                                    className="w-full px-2 py-1 border rounded text-sm" 
                                    placeholder="Optional" 
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input 
                                    type="text" 
                                    value={v.description || ""} 
                                    onChange={(e) => updateUrlVariable(idx, "description", e.target.value)} 
                                    className="w-full px-2 py-1 border rounded text-sm" 
                                    placeholder="Optional note" 
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <select 
                                    value={v.required} 
                                    onChange={(e) => updateUrlVariable(idx, "required", e.target.value)} 
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="unique">Unique</option>
                                    <option value="required">Required</option>
                                    <option value="optional">Optional</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <select 
                                    value={v.authentication} 
                                    onChange={(e) => updateUrlVariable(idx, "authentication", e.target.value)} 
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="no_authentication">None</option>
                                    <option value="basic">Basic</option>
                                    <option value="token">Token</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  {isUsed ? (
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs font-semibold text-green-600">✓ Mapped & Used</span>
                                      <div className="flex flex-wrap gap-1">
                                        {usedInRedirects.map((redirectType, i) => (
                                          <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs capitalize">
                                            {redirectType}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-yellow-600 text-xs font-semibold">⚠️ Not used in redirects</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <button 
                                    type="button" 
                                    onClick={() => setForm(p => ({...p, url_variables: p.url_variables.filter((_, i) => i !== idx)}))} 
                                    className="text-red-600 hover:text-red-800 text-lg font-bold"
                                    title="Delete variable"
                                  >×</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Exit Pages */}
                <div className="border rounded p-4">
                  <div className="flex justify-between mb-4">
                    <h3 className="font-bold">Exit Redirect URLs</h3>
                    <button type="button" onClick={() => setCustomExitPages([...customExitPages, {id: `custom_${Date.now()}`, condition: {type: "terminated", marker: ""}, redirect_url: ""}])} 
                      className={`${btnClass} bg-gray-100 text-sm`}>+ Custom Exit</button>
                  </div>
                  <div className="space-y-3">
                    {customExitPages.map((page, idx) => (
                      <div key={idx} className="border-l-4 border-purple-500 bg-purple-50 p-3 rounded-r">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-semibold">Custom Exit</span>
                          <button type="button" onClick={() => setCustomExitPages(customExitPages.filter((_, i) => i !== idx))} 
                            className="text-red-600">✕</button>
                        </div>
                        <div className="flex gap-2 mb-2 text-sm">
                          <span>Show if:</span>
                          <select value={page.condition.type} onChange={(e) => setCustomExitPages(customExitPages.map((p, i) => i === idx ? {...p, condition: {...p.condition, type: e.target.value}} : p))} 
                            className="px-2 py-1 border rounded">
                            <option value="terminated">Terminated</option>
                            <option value="qualified">Qualified</option>
                            <option value="quota_full">Quota Full</option>
                          </select>
                          <span>& marker:</span>
                          <input type="text" value={page.condition.marker || ""} onChange={(e) => setCustomExitPages(customExitPages.map((p, i) => i === idx ? {...p, condition: {...p.condition, marker: e.target.value}} : p))} 
                            className="flex-1 px-2 py-1 border rounded" placeholder="optional_marker" />
                        </div>
                        <input type="url" value={page.redirect_url} onChange={(e) => setCustomExitPages(customExitPages.map((p, i) => i === idx ? {...p, redirect_url: e.target.value} : p))} 
                          className={inputClass} placeholder="https://panel.com/callback?status=X&variable=${your_variable}" />
                      </div>
                    ))}
                    {["terminated", "quota_full", "qualified"].map(key => (
                      <div key={key} className={`border-l-4 ${key === "qualified" ? "border-green-500 bg-green-50" : key === "quota_full" ? "border-yellow-500 bg-yellow-50" : "border-red-500 bg-red-50"} p-3 rounded-r`}>
                        <label className="block font-semibold mb-2 text-sm capitalize">{key.replace("_", " ")}</label>
                        <input type="url" value={standardExits[key]} onChange={(e) => setStandardExits({...standardExits, [key]: e.target.value})} 
                          className={inputClass} placeholder="https://panel.com/callback?status=complete&variable=${your_variable}" />
                        <p className="text-xs text-gray-600 mt-1">
                          Use <code className="bg-white px-1 rounded">$&#123;variable_name&#125;</code> to insert mapped variables
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => confirm("Cancel changes?") && (onClose ? onClose() : setShowTemplateSelector(true))} 
                    className={`${btnClass} border`}>Cancel</button>
                  <button type="submit" disabled={isSaving || !form.source_name.trim()} 
className={`${btnClass} bg-blue-600 text-white disabled:opacity-50`}>
                    {isSaving ? "Saving..." : selectedSourceId ? "Save Changes" : "Create Panel"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}