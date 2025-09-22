// utils/emailTemplates.js
export const slugify = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 64);

export const extractVars = (subject = "", html = "", text = "") => {
  const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
  const out = new Set();
  for (const str of [subject, html, text]) {
    if (!str) continue;
    let m;
    while ((m = re.exec(str))) out.add(m[1]);
  }
  return Array.from(out);
};

export const applyVars = (content = "", vars = {}) =>
  String(content).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
    // support dot paths: order.id => vars.order?.id
    const path = k.split(".");
    let v = vars;
    for (const p of path) v = v?.[p];
    return v == null ? `{{${k}}}` : String(v);
  });

export const debounce = (fn, ms = 800) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// simple “starter” template content used by "New"
export const STARTER_TEMPLATE = {
  subject: "Welcome {{name}}!",
  html:
    "<h1 style='margin:0 0 8px'>Hello {{name}}</h1>" +
    "<p style='margin:0 0 16px'>We're excited to have you at {{company}}.</p>" +
    "<p style='margin:0 0 16px'>Get started ➜ <a href='{{ctaUrl}}'>{{ctaLabel}}</a></p>",
  text:
    "Hello {{name}}\n\nWe're excited to have you at {{company}}.\n" +
    "Get started: {{ctaUrl}}",
  sampleVars: { name: "John Doe", company: "Acme Corp", ctaUrl: "https://example.com", ctaLabel: "Open dashboard" },
};
