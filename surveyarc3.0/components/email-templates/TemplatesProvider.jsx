"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, limit as qLimit, startAfter, serverTimestamp, writeBatch
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";
import { debounce, slugify, STARTER_TEMPLATE } from "@/utils/emailTemplates";

const TemplatesCtx = createContext(null);
export const useTemplates = () => useContext(TemplatesCtx);

export default function TemplatesProvider({ children }) {
  const { orgId } = useRouteParams();

  // list state
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [cursor, setCursor] = useState(null);

  // current doc state
  const [currentId, setCurrentId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    html: "",
    text: "",
    tags: [],
    status: "draft",
  });
  const [varsPreview, setVarsPreview] = useState({});
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const PAGE = 30;

  const coll = useMemo(() => collection(db, "organizations", orgId, "templates"), [orgId]);

  const fetch = useCallback(async (after = null) => {
    setLoadingList(true);
    try {
      let q = query(coll, orderBy("updatedAt", "desc"), qLimit(PAGE));
      if (after) q = query(q, startAfter(after));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const term = search.trim().toLowerCase();
      const filtered = term
        ? items.filter(
            (r) =>
              r.name?.toLowerCase().includes(term) ||
              r.subject?.toLowerCase().includes(term) ||
              (Array.isArray(r.tags) && r.tags.some((t) => t.toLowerCase().includes(term)))
          )
        : items;
      setRows(filtered);
      setCursor(snap.docs[snap.docs.length - 1] || null);
    } finally {
      setLoadingList(false);
    }
  }, [coll, search]);

  useEffect(() => {
    fetch(null);
  }, [fetch]);

  const loadMore = useCallback(() => cursor && fetch(cursor), [cursor, fetch]);

  const open = useCallback(async (id) => {
    const snap = await getDoc(doc(coll, id));
    if (!snap.exists()) return;
    const d = snap.data();
        const ref = doc(coll);

    setCurrentId(id);
    setForm({
      name: d.name || "",
      subject: d.subject || "",
      html: d.html || "",
      text: d.text || "",
      tags: Array.isArray(d.tags) ? d.tags : [],
      status: d.status || "draft",
    });
    setVarsPreview(d.sampleVars || {});
  }, [coll]);

  const createNew = useCallback(async () => {
    const ref = doc(coll);
    const now = serverTimestamp();
    
    await setDoc(ref, {
      id: ref.id,
      name: "Untitled Template",
      slug: slugify(`untitled-${ref.id.slice(0, 6)}`),
      tags: ["welcome"],
      status: "draft",
      version: 0,
      createdAt: now,
      updatedAt: now,
      ...STARTER_TEMPLATE,
      nameLower: "untitled template",
    });
    await open(ref.id);
    fetch(null);
  }, [coll, open, fetch]);

  const duplicate = useCallback(async (id) => {
    const src = await getDoc(doc(coll, id));
    if (!src.exists()) return;
    const s = src.data();
    const ref = doc(coll);
    const now = serverTimestamp();
    await setDoc(ref, {
      ...s,
      id: ref.id,
      name: `${s.name || "Template"} (Copy)`,
      slug: slugify(`${s.slug || s.name || "template"}-copy-${ref.id.slice(0, 4)}`),
      createdAt: now,
      updatedAt: now,
      version: 0,
      status: "draft",
      nameLower: String(`${s.name || "template"} (copy)`).toLowerCase(),
    });
    await open(ref.id);
    fetch(null);
  }, [coll, open, fetch]);

  const remove = useCallback(async (id) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    // delete versions subcollection
    const verColl = collection(db, "organizations", orgId, "templates", id, "versions");
    const vers = await getDocs(verColl);
    if (!vers.empty) {
      const batch = writeBatch(db);
      vers.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(coll, id));
    if (currentId === id) {
      setCurrentId(null);
      setForm({ name: "", subject: "", html: "", text: "", tags: [], status: "draft" });
      setVarsPreview({});
    }
    fetch(null);
  }, [coll, currentId, fetch, orgId]);

  const saveNow = useCallback(async (id, patch) => {
    setSaving(true);
    try {
      await updateDoc(doc(coll, id), {
        ...patch,
        sampleVars: varsPreview,
        nameLower: String(patch.name || "").toLowerCase(),
        updatedAt: serverTimestamp(),
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
    } finally {
      setSaving(false);
    }
  }, [coll, varsPreview]);

  const debouncedSave = useMemo(() => debounce(saveNow, 900), [saveNow]);

  useEffect(() => {
    if (!currentId) return;
    if (!form.name?.trim()) return; // avoid saving empty untitled on first render
    debouncedSave(currentId, form);
  }, [currentId, form, debouncedSave]);

  const publish = useCallback(async () => {
    if (!currentId) return;
    const ref = doc(coll, currentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data();
    const newVersion = (d.version || 0) + 1;
    // snapshot current content into versions
    await setDoc(doc(collection(ref, "versions")), {
      version: newVersion,
      subject: d.subject || "",
      html: d.html || "",
      text: d.text || "",
      tags: d.tags || [],
      vars: d.sampleVars || {},
      createdAt: serverTimestamp(),
    });
    await updateDoc(ref, { version: newVersion, status: "published", updatedAt: serverTimestamp() });
    setForm((f) => ({ ...f, status: "published" }));
    fetch(null);
  }, [coll, currentId, fetch]);

  const exportJSON = useCallback(() => {
    if (!currentId) return;
    const data = { ...form, sampleVars: varsPreview, __meta: { format: "email-template@v1" } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slugify(form.name || "template")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [currentId, form, varsPreview]);

  const importJSON = useCallback(async (file) => {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !data.name || (!data.html && !data.text)) {
      alert("Invalid template file");
      return;
    }
    const ref = doc(coll);
    await setDoc(ref, {
      name: `${data.name} (Imported)`,
      nameLower: String(`${data.name} (Imported)`).toLowerCase(),
      slug: slugify(data.slug || data.name),
      subject: data.subject || "",
      html: data.html || "",
      text: data.text || "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      status: "draft",
      version: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      sampleVars: data.sampleVars || {},
    });
    await open(ref.id);
    fetch(null);
  }, [coll, open, fetch]);

  const value = {
    // list
    rows, search, setSearch, loadingList, loadMore, fetch,
    // current
    currentId, setCurrentId, form, setForm, varsPreview, setVarsPreview,
    saving, justSaved,
    // actions
    open, createNew, duplicate, remove, publish, exportJSON, importJSON,
  };

  return <TemplatesCtx.Provider value={value}>{children}</TemplatesCtx.Provider>;
}
