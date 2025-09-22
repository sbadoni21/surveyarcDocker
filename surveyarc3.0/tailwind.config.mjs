/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./page/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: { 
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        primary: "var(--primary)",
        primaryHover: "var(--primary-hover)",
        secondary: "var(--secondary)",
        secondaryHover: "var(--secondary-hover)",
        border: "var(--border)",
      },
    },
  },
  plugins: [],
};
