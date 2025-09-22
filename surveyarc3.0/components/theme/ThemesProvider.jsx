"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, arrayUnion, arrayRemove
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";
import { DEFAULT_THEME } from "@/utils/themeSchema";

const Ctx = createContext(null);
export const useThemes = () => useContext(Ctx);

const getSurveyRef = (orgId, surveyId) => doc(db, "organizations", orgId, "surveys", surveyId);

export default function ThemesProvider({ children }) {
  const { orgId, surveyId } = useRouteParams(); // make sure this returns both
  const coll = useMemo(() => collection(db, "organizations", orgId, "themes"), [orgId]);

  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState(null);
  const [theme, setTheme] = useState(null); // current editable theme
  const [surveyThemeId, setSurveyThemeId] = useState(null);

  // Load themes and survey's selected theme
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure default exists
      const ensureDefault = async () => {
        const qSnap = await getDocs(query(coll, orderBy("createdAt", "asc")));
        const docs = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (docs.length === 0) {
          const ref = doc(coll);
          await setDoc(ref, {
            id: ref.id,
            ...DEFAULT_THEME,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            usedBy: [],
          });
          return [{ id: ref.id, ...DEFAULT_THEME }];
        }
        // backfill id if missing
        for (const d of docs) {
          if (!d.id) await updateDoc(doc(coll, d.id), { id: d.id });
        }
        return docs;
      };

      const themeList = await ensureDefault();
      setThemes(themeList);

      // survey theme
      if (surveyId) {
        const sSnap = await getDoc(getSurveyRef(orgId, surveyId));
        const s = sSnap.exists() ? sSnap.data() : null;
        setSurveyThemeId(s?.themeId || themeList[0]?.id || null);
        if (!s?.themeId && themeList[0]) {
          // attach default on first visit
          await updateDoc(getSurveyRef(orgId, surveyId), { themeId: themeList[0].id });
          await updateDoc(doc(coll, themeList[0].id), { usedBy: arrayUnion(surveyId) });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [coll, orgId, surveyId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const open = useCallback(async (id) => {
    const snap = await getDoc(doc(coll, id));
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.id) await updateDoc(doc(coll, id), { id }); // backfill
    setCurrentId(id);
    setTheme({ id, ...data });
  }, [coll]);
// ThemesProvider.jsx

const flattenToDot = (obj, prefix = "") => {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenToDot(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
};

const deepMerge = (base, patch) => {
  const out = structuredClone(base || {});
  const walk = (t, p) => {
    for (const [k, v] of Object.entries(p || {})) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        t[k] = deepMerge(t[k] || {}, v);
      } else {
        t[k] = v;
      }
    }
    return t;
  };
  return walk(out, patch);
};

const saveTheme = useCallback(async (patch) => {
  if (!currentId) return;
  const ref = doc(coll, currentId);
  const flattened = flattenToDot(patch);
  await updateDoc(ref, { ...flattened, updatedAt: serverTimestamp() });
  setTheme((t) => deepMerge(t, patch));
}, [coll, currentId]);

  const createTheme = useCallback(async () => {
    const ref = doc(coll);
    const base = {
      id: ref.id,
      ...DEFAULT_THEME,
      name: "New Theme",
      isDefault: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      usedBy: [],
    };
    await setDoc(ref, base);
    setThemes(prev => [{ ...base }, ...prev]);
    await open(ref.id);
  }, [coll, open]);

  const duplicateTheme = useCallback(async (id) => {
    const src = await getDoc(doc(coll, id));
    if (!src.exists()) return;
    const ref = doc(coll);
    const data = src.data();
    const copy = {
      ...data,
      id: ref.id,
      name: `${data.name || "Theme"} (Copy)`,
      isDefault: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      usedBy: [],
    };
    await setDoc(ref, copy);
    setThemes(prev => [copy, ...prev]);
    await open(ref.id);
  }, [coll, open]);


  const deleteTheme = useCallback(async (id) => {
    // guard default theme
    const snap = await getDoc(doc(coll, id));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.isDefault) {
      alert("Default theme cannot be deleted.");
      return;
    }
    if (!confirm("Delete this theme? Surveys using it will fall back to Default.")) return;

    // detach from surveys using it
    const usedBy = Array.isArray(data.usedBy) ? data.usedBy : [];
    const qSnap = await getDocs(collection(db, "organizations", orgId, "surveys"));
    const batchPromises = [];
    for (const docSnap of qSnap.docs) {
      if (usedBy.includes(docSnap.id)) {
        batchPromises.push(updateDoc(docSnap.ref, { themeId: null }));
      }
    }
    await Promise.all(batchPromises);

    await deleteDoc(doc(coll, id));
    setThemes(prev => prev.filter(t => t.id !== id));
    if (currentId === id) { setCurrentId(null); setTheme(null); }
  }, [coll, currentId, orgId]);

  const attachToSurvey = useCallback(async (newThemeId) => {
    if (!surveyId) return;
    const surveyRef = getSurveyRef(orgId, surveyId);
    const prevSnap = await getDoc(surveyRef);
    const prevId = prevSnap.exists() ? prevSnap.data()?.themeId : null;

    await updateDoc(surveyRef, { themeId: newThemeId });

    if (prevId && prevId !== newThemeId) {
      await updateDoc(doc(coll, prevId), { usedBy: arrayRemove(surveyId) });
    }
    await updateDoc(doc(coll, newThemeId), { usedBy: arrayUnion(surveyId) });

    setSurveyThemeId(newThemeId);
  }, [coll, orgId, surveyId]);

  const value = {
    loading, themes, currentId, theme, surveyThemeId,
    open, createTheme, duplicateTheme, deleteTheme, saveTheme, attachToSurvey
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
