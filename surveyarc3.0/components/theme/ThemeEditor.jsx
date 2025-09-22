"use client";
import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useCallback,
} from "react";
import { useThemes } from "./ThemesProvider";

/* ====================== STABLE DEFAULTS ====================== */
const DEFAULTS = Object.freeze({
  name: "",
  header: { showTitle: true, align: "left" },
  footer: { text: "" },
  typography: { headingFont: "", bodyFont: "", baseSize: 16 },
  controls: { radius: 12, shadow: "sm", buttonStyle: "solid", progressBar: "thin" },
  palette: {
    primary: "#3b82f6",
    secondary: "#6b7280",
    background: "#ffffff",
    surface: "#f8f9fa",
    text: "#000000",
    muted: "#6b7280",
  },
  // keep brand bits isolated from `name`
  logo: {
    alt: "",
    url: "",
  },
});

/* ====================== HELPERS ====================== */
const mergeDefaults = (theme) => {
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  const assign = (t, s) => {
    Object.keys(s || {}).forEach((k) => {
      if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k])) {
        t[k] = t[k] || {};
        assign(t[k], s[k]);
      } else {
        t[k] = s[k];
      }
    });
    return t;
  };
  return assign(out, theme || {});
};

const setByPath = (obj, path, value) => {
  const parts = path.split(".");
  const clone = { ...obj };
  let cur = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    cur[k] = cur[k] ? { ...cur[k] } : {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return clone;
};

const diffObjects = (base, next, prefix = "", out = {}) => {
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(next || {})]);
  keys.forEach((k) => {
    const a = base ? base[k] : undefined;
    const b = next ? next[k] : undefined;
    const path = prefix ? `${prefix}.${k}` : k;
    if (a && typeof a === "object" && !Array.isArray(a) && b && typeof b === "object" && !Array.isArray(b)) {
      diffObjects(a, b, path, out);
    } else if (b !== a) {
      out[path] = b;
    }
  });
  return out;
};

/* ====================== RAF-BATCH DISPATCH ====================== */
function useRafDispatcher(dispatch) {
  const frameRef = useRef(null);
  const queueRef = useRef([]); // [{path, value}...]

  const schedule = useCallback(
    (path, value) => {
      queueRef.current.push({ path, value });
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        const queued = queueRef.current;
        queueRef.current = [];
        frameRef.current = null;
        if (queued.length) dispatch({ type: "BULK_SET", payload: queued });
      });
    },
    [dispatch]
  );

  useEffect(() => () => frameRef.current && cancelAnimationFrame(frameRef.current), []);
  return schedule;
}

/* ====================== REDUCER ====================== */
const initialState = { draft: null, pristine: null, hasChanges: false };

function reducer(state, action) {
  switch (action.type) {
    case "INIT": {
      const merged = mergeDefaults(action.theme);
      return { draft: merged, pristine: merged, hasChanges: false };
    }
    case "BULK_SET": {
      let next = state.draft;
      for (const { path, value } of action.payload) {
        next = setByPath(next, path, value);
      }
      const has = JSON.stringify(next) !== JSON.stringify(state.pristine);
      return { ...state, draft: next, hasChanges: has };
    }
    case "RESET": {
      return { draft: state.pristine, pristine: state.pristine, hasChanges: false };
    }
    case "COMMIT_PRISTINE": {
      return { draft: action.next, pristine: action.next, hasChanges: false };
    }
    default:
      return state;
  }
}

/* ====================== UI ATOMS ====================== */
const Section = React.memo(function Section({ title, hint, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="font-semibold">{title}</h4>
        {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
});

const Row = React.memo(function Row({ label, children }) {
  return (
    <label className="grid grid-cols-3 gap-3 items-center">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="col-span-2">{children}</div>
    </label>
  );
});

const ColorRow = React.memo(function ColorRow({ label, value, onHex, onPick }) {
  return (
    <div className="flex items-center justify-between gap-3 border rounded-lg p-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
        <input
          className="w-28 border rounded px-2 py-1 text-xs"
          value={value}
          onChange={(e) => onHex(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          name={`color_${label}`} // unique name, avoids autofill collisions
        />
      </div>
    </div>
  );
});

/* ====================== SAFE LOGO UPLOADER ====================== */
/** This uploader ONLY updates branding.logoUrl, never touches name or branding.logoText */
const SafeLogoUploader = React.memo(function SafeLogoUploader({ value, onChange }) {
  const urlRef = useRef(null);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Clean up previous blob URL to prevent memory leaks
    if (urlRef.current && urlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(urlRef.current);
    }
    
    // TODO: replace this with your actual upload; this is just a preview URL
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    onChange(url); // only update branding.logoUrl
  };

  const handleClear = () => {
    // Clean up blob URL when clearing
    if (urlRef.current && urlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(urlRef.current);
    }
    urlRef.current = null;
    onChange("");
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (urlRef.current && urlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  // Update ref when value changes externally (theme switching)
  useEffect(() => {
    if (value !== urlRef.current) {
      // If switching to a different theme, clean up previous blob URL
      if (urlRef.current && urlRef.current.startsWith('blob:') && value !== urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
      urlRef.current = value;
    }
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-3">
      {value ? (
        <img
          src={value}
          alt="Logo preview"
          className="h-8 w-8 rounded border object-contain"
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
      ) : (
        <div className="h-8 w-8 rounded border bg-gray-50" />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handlePick}
        value="" 
        name="logoFile" 
      />
      <button
        type="button"
        className="px-2 py-1 text-sm border rounded"
        onClick={handleClear}
      >
        Clear
      </button>
    </div>
  );
});

/* ====================== MAIN EDITOR ====================== */
export default function ThemeEditor({ onDraftChange }) {
  const { theme, saveTheme } = useThemes();
  const [state, dispatch] = useReducer(reducer, initialState);
  const rafSet = useRafDispatcher(dispatch);

  // init on theme change
  useEffect(() => {
    if (theme) dispatch({ type: "INIT", theme });
  }, [theme]);

  // Notify parent of draft changes
  useEffect(() => {
    if (onDraftChange) {
      onDraftChange(state.draft);
    }
  }, [state.draft, onDraftChange]);

  // local space-key guard (prevents page jumping if focus blips)
  const rootRef = useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKeyDown = (e) => {
      const t = e.target;
      const isEditable =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (isEditable && e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener("keydown", onKeyDown, true);
    return () => el.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const setField = useCallback((path, value) => {
    rafSet(path, value);
  }, [rafSet]);

  const draft = state.draft;
  const hasChanges = state.hasChanges;

  const paletteEntries = useMemo(() => {
    if (!draft) return [];
    const p = draft.palette || {};
    return Object.entries({
      primary: "#3b82f6",
      secondary: "#6b7280",
      background: "#ffffff",
      surface: "#f8f9fa",
      text: "#000000",
      muted: "#6b7280",
      ...p,
    });
  }, [draft]);

  if (!draft) {
    return (
      <section className="bg-white rounded-xl border shadow-sm p-8 text-center text-gray-500">
        Select a theme to edit
      </section>
    );
  }

  const handleSave = async () => {
    const patch = diffObjects(theme || {}, draft || {});
    if (Object.keys(patch).length) {
      await saveTheme(patch);
      const merged = mergeDefaults({ ...(theme || {}), ...patch });
      dispatch({ type: "COMMIT_PRISTINE", next: merged });
    } else {
      dispatch({ type: "COMMIT_PRISTINE", next: draft });
    }
  };

  const handleReset = () => dispatch({ type: "RESET" });

  return (
    <div ref={rootRef} className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">Theme Editor</h3>
            {draft.isDefault ? <span className="text-xs text-gray-500">Default theme</span> : null}
            {hasChanges ? (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                Unsaved changes
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left */}
        <div className="space-y-6">
          <Section title="Basics">
            <div className="space-y-3">
              {/* Theme Name — unique name attr to avoid autofill collisions */}
              <Row label="Theme Name">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={draft.name ?? ""}
                  onChange={(e) => setField("name", e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  name="themeName"  // unique
                />
              </Row>

              {/* Logo image: updates only branding.logoUrl */}
              <Row label="Logo">
                <SafeLogoUploader
                  value={draft?.logo?.url ?? ""}
                  onChange={(url) => setField("logo.url", url)}
                />
              </Row>

              {/* Logo Text: isolated under branding.logoText (won't touch theme name) */}
              <Row label="Logo Text">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={draft?.branding?.logoText ?? ""}
                  onChange={(e) => setField("branding.logoText", e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  name="logoText"   // unique
                />
              </Row>
            </div>
          </Section>

          <Section title="Header">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft?.header?.showTitle ?? true}
                  onChange={(e) => setField("header.showTitle", e.target.checked)}
                />
                Show survey title
              </label>
              <select
                className="border rounded-lg px-2 py-1 text-sm"
                value={draft?.header?.align || "left"}
                onChange={(e) => setField("header.align", e.target.value)}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
          </Section>

          <Section title="Footer">
            <textarea
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Thanks for your time!"
              value={draft?.footer?.text ?? ""}
              onChange={(e) => setField("footer.text", e.target.value)}
            />
          </Section>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Section title="Palette" hint="Click the swatch to pick a color.">
            <div className="grid grid-cols-2 gap-3">
              {paletteEntries.map(([k, v]) => (
                <ColorRow
                  key={k}
                  label={k.charAt(0).toUpperCase() + k.slice(1)}
                  value={v}
                  onPick={(val) => setField(`palette.${k}`, val)}
                  onHex={(val) => setField(`palette.${k}`, val)}
                />
              ))}
            </div>
          </Section>

          <Section title="Typography">
            <div className="grid grid-cols-3 gap-3">
              <input
                className="col-span-2 border rounded-lg px-3 py-2 text-sm"
                placeholder="Heading font"
                value={draft?.typography?.headingFont ?? ""}
                onChange={(e) => setField("typography.headingFont", e.target.value)}
                autoComplete="off"
                spellCheck={false}
                name="headingFont"
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Base size"
                type="number"
                min={12}
                max={22}
                value={draft?.typography?.baseSize ?? 16}
                onChange={(e) => setField("typography.baseSize", Number(e.target.value || 16))}
                name="baseSize"
              />
              <input
                className="col-span-3 border rounded-lg px-3 py-2 text-sm"
                placeholder="Body font"
                value={draft?.typography?.bodyFont ?? ""}
                onChange={(e) => setField("typography.bodyFont", e.target.value)}
                autoComplete="off"
                spellCheck={false}
                name="bodyFont"
              />
            </div>
          </Section>

          <Section title="Controls">
            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="col-span-1">
                <label className="text-xs text-gray-500">Radius</label>
                <input
                  className="w-full border rounded-lg px-2 py-1"
                  type="number"
                  min={0}
                  max={24}
                  value={draft?.controls?.radius ?? 12}
                  onChange={(e) => setField("controls.radius", Number(e.target.value || 12))}
                  name="radius"
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-gray-500">Shadow</label>
                <select
                  className="w-full border rounded-lg px-2 py-1"
                  value={draft?.controls?.shadow || "sm"}
                  onChange={(e) => setField("controls.shadow", e.target.value)}
                  name="shadow"
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-gray-500">Buttons</label>
                <select
                  className="w-full border rounded-lg px-2 py-1"
                  value={draft?.controls?.buttonStyle || "solid"}
                  onChange={(e) => setField("controls.buttonStyle", e.target.value)}
                  name="buttonStyle"
                >
                  <option value="solid">Solid</option>
                  <option value="outline">Outline</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-gray-500">Progress bar</label>
                <select
                  className="w-full border rounded-lg px-2 py-1"
                  value={draft?.controls?.progressBar || "thin"}
                  onChange={(e) => setField("controls.progressBar", e.target.value)}
                  name="progressBar"
                >
                  <option value="thin">Thin</option>
                  <option value="thick">Thick</option>
                </select>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}