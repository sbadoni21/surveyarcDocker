// utils/themeSchema.js
export const DEFAULT_THEME = {
  name: "Default",
  isDefault: true,
  palette: {
    primary: "#ED7A13",
    secondary: "#111827",
    background: "#ffffff",
    surface: "#f5f5f5",
    text: "#111827",
    muted: "#6B7280",
    success: "#16A34A",
    warning: "#F59E0B",
    danger:  "#DC2626",
  },
  typography: {
    headingFont: "Inter, system-ui, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    baseSize: 16,
  },
  controls: {
    radius: 12,
    shadow: "sm",              // "none" | "sm" | "md" | "lg"
    buttonStyle: "solid",      // "solid" | "outline"
    progressBar: "thin",       // "thin" | "thick"
  },
  logo: { url: "", alt: "" },
  header: { showTitle: true, align: "left" },
  footer: { text: "" },
};
