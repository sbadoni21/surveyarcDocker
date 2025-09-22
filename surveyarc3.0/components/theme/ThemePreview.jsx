"use client";
import React from "react";
import { useThemes } from "./ThemesProvider";

// Simple visual preview using inline styles (no external CSS changes)
export default function ThemePreview({ draftTheme = null }) {
  const { theme } = useThemes();
  
  // Use draftTheme if provided (live editing), otherwise fall back to saved theme
  const activeTheme = draftTheme || theme;
  
  if (!activeTheme) return null;

  const p = activeTheme.palette || {};
  const t = activeTheme.typography || {};
  const c = activeTheme.controls || {};
  const h = activeTheme.header || {};
  const f = activeTheme.footer || {};
  const b = activeTheme.logo || {};

  const cardShadow =
    c.shadow === "lg" ? "0 10px 25px rgba(0,0,0,.12)" :
    c.shadow === "md" ? "0 6px 16px rgba(0,0,0,.10)" :
    c.shadow === "sm" ? "0 4px 8px rgba(0,0,0,.08)" : "none";

  const btnBase = {
    borderRadius: `${c.radius || 12}px`,
    padding: "10px 16px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontSize: "14px",
  };

  const solidBtn = {
    ...btnBase,
    background: p.primary || "#3b82f6",
    color: "white",
    border: `1px solid ${p.primary || "#3b82f6"}`,
  };

  const outlineBtn = {
    ...btnBase,
    background: "transparent",
    color: p.primary || "#3b82f6",
    border: `1px solid ${p.primary || "#3b82f6"}`,
  };

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Live Preview</h3>
        <p className="text-xs text-gray-500 mt-1">A quick mock of how your survey will look.</p>
      </div>

      <div
        className="p-6"
        style={{
          background: p.background || "#ffffff",
          color: p.text || "#000000",
          fontFamily: t.bodyFont || "system-ui, sans-serif",
          fontSize: `${t.baseSize || 16}px`,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5" style={{ alignItems: "center" }}>
          {b.url ? (
            <img 
              src={b.url} 
              alt="Logo" 
              style={{ 
                height: 36, 
                width: "auto",
                borderRadius: 6,
                objectFit: "contain"
              }} 
            />
          ) : (
            <div style={{ 
              height: 36, 
              width: 36, 
              borderRadius: 6, 
              background: p.surface || "#f8f9fa", 
              border: "1px solid #e5e7eb" 
            }} />
          )}
          
        
        </div>

        {/* Card */}
        <div
          style={{ 
            background: p.surface || "#ffffff", 
            boxShadow: cardShadow, 
            borderRadius: `${c.radius || 12}px`,
            padding: "20px",
            border: "1px solid #e5e7eb"
          }}
        >
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: "8px",
            fontFamily: t.headingFont || "system-ui, sans-serif",
            fontSize: `${(t.baseSize || 16) * 1.25}px`,
            fontWeight: 600,
          }}>
            A question appears here
          </h3>
          <p style={{ 
            color: p.muted || "#6b7280", 
            marginTop: 0, 
            marginBottom: 16,
            fontSize: `${(t.baseSize || 16) * 0.875}px`,
          }}>
            Optional description helps the respondent.
          </p>

          <input
            placeholder="Your answer"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: `${c.radius || 12}px`,
              border: "1px solid #e5e7eb",
              outlineColor: p.primary || "#3b82f6",
              background: "#fff",
              color: p.text || "#000000",
              fontSize: `${t.baseSize || 16}px`,
              fontFamily: t.bodyFont || "system-ui, sans-serif",
            }}
          />

          {/* Progress + actions */}
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                height: c.progressBar === "thick" ? 10 : 4,
                background: "#e5e7eb",
                borderRadius: 999,
                width: "40%",
                overflow: "hidden",
              }}
            >
              <div style={{ 
                height: "100%", 
                width: "60%", 
                background: p.primary || "#3b82f6" 
              }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button style={c.buttonStyle === "solid" ? outlineBtn : solidBtn}>Back</button>
              <button style={c.buttonStyle === "solid" ? solidBtn : outlineBtn}>Next</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        {f.text && (
          <div style={{ 
            fontSize: "12px", 
            color: p.muted || "#6b7280", 
            marginTop: 24,
            textAlign: "center"
          }}>
            {f.text}
          </div>
        )}
      </div>
    </section>
  );
}