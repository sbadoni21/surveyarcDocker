// utils/providerTemplates.js
export const PROVIDER_TEMPLATES = [
  // Major Panels
  { id: "dynata", label: "Dynata / SSI", icon: "🔷" },
  { id: "cint", label: "Cint", icon: "🔵" },
  { id: "lucid", label: "Lucid", icon: "💎" },
  { id: "purespectrum", label: "PureSpectrum", icon: "🌈" },
  
  // Mid-Size Panels
  { id: "innovate", label: "InnovateMR", icon: "🚀" },
  { id: "azure", label: "Azure / Xurway", icon: "☁️" },
  { id: "veridata", label: "Veridata", icon: "✓" },
  { id: "repdata", label: "RepData", icon: "📊" },
  
  // Specialized Panels
  { id: "lynk", label: "Lynk Global", icon: "🔗" },
  { id: "maven", label: "Maven", icon: "🎯" },
  { id: "emporia", label: "Emporia Research", icon: "🏛️" },
  { id: "grapedata", label: "GrapeData", icon: "🍇" },
  { id: "dialecticanet", label: "Dialecticanet", icon: "💬" },
  { id: "questionlab", label: "QuestionLab", icon: "❓" },
  { id: "exactinsight", label: "ExactInsight", icon: "🎲" },
  { id: "colemanrg", label: "Coleman RG", icon: "🏢" },
  { id: "borderless", label: "Borderless / Panel Station", icon: "🌐" },
  
  // Other Options
  { id: "file", label: "File / CSV Upload", icon: "📁" },
  { id: "custom_external", label: "Custom External", icon: "⚙️" },
];

// Helper to get template info
export function getTemplateInfo(templateId) {
  return PROVIDER_TEMPLATES.find(t => t.id === templateId) || PROVIDER_TEMPLATES.find(t => t.id === 'custom_external');
}

// Group templates by category for better UI
export const TEMPLATE_CATEGORIES = {
  major: ["dynata", "cint", "lucid", "purespectrum"],
  midsize: ["innovate", "azure", "veridata", "repdata"],
  specialized: [
    "lynk", "maven", "emporia", "grapedata", 
    "dialecticanet", "questionlab", "exactinsight", 
    "colemanrg", "borderless"
  ],
  other: ["file", "custom_external"],
};

export const CATEGORY_LABELS = {
  major: "Major Panels",
  midsize: "Mid-Size Panels",
  specialized: "Specialized Panels",
  other: "Other Options",
};