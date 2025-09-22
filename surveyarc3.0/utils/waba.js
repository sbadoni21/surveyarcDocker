export function slugifyWabaName(s = "") {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")        // spaces → underscore
    .replace(/[^a-z0-9_]/g, "_") // only a-z 0-9 _
    .replace(/_+/g, "_")         // collapse repeats
    .replace(/^_+|_+$/g, "");    // trim underscores
}
// utils/wabaName.js
