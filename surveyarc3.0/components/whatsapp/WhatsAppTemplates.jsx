import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection, getDocs, doc, getDoc,
  setDoc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";
import { 
  Plus, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  Send, 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Search,
  Filter,
  Eye,
  Library
} from 'lucide-react';

// Import the enhanced template editor
import WhatsAppTemplateEditor from "./WhatsAppTemplateEditor";
import TemplateLibrary from "./TemplateLibrary";
import { slugifyWabaName } from "@/utils/waba";

const STATUS_CONFIG = {
  draft: { 
    color: "bg-gray-100 text-gray-700 border-gray-200", 
    icon: Edit3, 
    label: "Draft" 
  },
  PENDING: { 
    color: "bg-amber-100 text-amber-700 border-amber-200", 
    icon: Clock, 
    label: "Pending Review" 
  },
  APPROVED: { 
    color: "bg-green-100 text-green-700 border-green-200", 
    icon: CheckCircle, 
    label: "Approved" 
  },
  REJECTED: { 
    color: "bg-red-100 text-red-700 border-red-200", 
    icon: XCircle, 
    label: "Rejected" 
  },
};

const CATEGORY_ICONS = {
  MARKETING: "📢",
  UTILITY: "🔧", 
  AUTHENTICATION: "🔐"
};

export default function WhatsAppTemplates() {
  const { orgId } = useRouteParams();
  const [items, setItems] = useState([]);
  const [openEditor, setOpenEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPreview, setShowPreview] = useState(null);
const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const snap = await getDocs(collection(db, "organizations", orgId, "whatsappTemplates"));
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a,b)=> (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
    setItems(rows);
  }, [orgId]);

  useEffect(()=>{ fetchTemplates(); }, [fetchTemplates]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchTerm || 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.components?.body?.text?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [items, searchTerm, statusFilter]);
 const handleTemplateSelection = (tpl) => {
   const base = tpl.id || tpl.name || "tpl";
   const draftName = slugifyWabaName(`${base}_copy`);
   setEditing({
     name: draftName,
     language: tpl.language || "en_US",
     category: tpl.category || "MARKETING",
     status: "draft",
     components: {
       header: tpl.components?.header || { type: "NONE", text: "" },
       body: tpl.components?.body || { text: "" },
       footer: tpl.components?.footer || { text: "" },
       buttons: tpl.components?.buttons || [],
     },
   });
   setOpenEditor(true);
   setShowTemplateLibrary(false);
 };
  const create = () => {
    setEditing({
      name: "",
      language: "en_US",
      category: "MARKETING",
      status: "draft",
      components: {
        header: { type: "NONE", text: "" },
        body: { text: "Hello {{1}}, welcome to our service! We're excited to have you." },
        footer: { text: "Thank you for choosing us" },
        buttons: []
      }
    });
    setOpenEditor(true);
  };

  const onSave = async (docId, data) => {
  const safeName = slugifyWabaName(data.name) || `tpl_${Date.now()}`;
  const id = docId || safeName.slice(0, 80);
      await setDoc(doc(db, "organizations", orgId, "whatsappTemplates", id), {
      ...data,
      
name: safeName,  
      updatedAt: serverTimestamp(),
      createdAt: data.createdAt || serverTimestamp(),
    }, { merge: true });
    setOpenEditor(false);
    setEditing(null);
    await fetchTemplates();
  };

  const remove = async (id) => {
    if (!confirm("Delete this template?")) return;
    await deleteDoc(doc(db, "organizations", orgId, "whatsappTemplates", id));
    await fetchTemplates();
  };

  const submitForApproval = async (id) => {
    setBusy(true);
    try {
      const tSnap = await getDoc(doc(db, "organizations", orgId, "whatsappTemplates", id));
      const tpl = tSnap.data();
      const idToken = await auth.currentUser?.getIdToken?.(true);
      const res = await fetch(
        "http://127.0.0.1:5001/surveyarc-v2/asia-south1/wabaCreateTemplate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({ orgId, templateId: id })
        }
      );
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || "Submit failed");
      await updateDoc(doc(db, "organizations", orgId, "whatsappTemplates", id), {
        status: "PENDING",
        lastSubmittedAt: serverTimestamp(),
      });
      await fetchTemplates();
      alert("✅ Template submitted for WhatsApp approval!");
    } catch (e) {
      console.error(e);
      alert(`❌ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const syncFromWaba = async () => {
    setBusy(true);
    try {
      const idToken = await auth.currentUser?.getIdToken?.(true);
      const res = await fetch(
        "http://127.0.0.1:5001/surveyarc-v2/asia-south1/wabaSyncTemplates",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({ orgId })
        }
      );
      if (!res.ok) throw new Error("Sync failed");
      await fetchTemplates();
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const renderTemplatePreview = (template) => {
    const { header, body, footer, buttons } = template.components;
    
    return (
      <div className="bg-gradient-to-b from-green-100 to-green-50 p-4 rounded-lg max-w-sm">
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
          <MessageCircle size={12} />
          <span>WhatsApp Business</span>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {header.type !== "NONE" && (
            <div className="bg-gray-50 px-3 py-2 border-b">
              <div className="text-sm font-medium text-gray-700">{header.text}</div>
            </div>
          )}

          <div className="p-3">
            <div className="text-sm whitespace-pre-wrap text-gray-800">
              {body.text}
            </div>
          </div>

          {footer.text && (
            <div className="px-3 pb-3">
              <div className="text-xs text-gray-500 italic">{footer.text}</div>
            </div>
          )}

          {buttons.length > 0 && (
            <div className="border-t bg-gray-50 p-2 space-y-1">
              {buttons.slice(0, 2).map((btn, index) => (
                <div key={index} className="text-xs py-1 px-2 text-center text-blue-600 bg-white rounded">
                  {btn.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    
    return (
      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <MessageCircle className="text-green-600" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">WhatsApp Templates</h2>
              <p className="text-gray-600">Create and manage message templates for WhatsApp Business</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={syncFromWaba} 
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              Sync Status
            </button>
            <button 
              onClick={() => setShowTemplateLibrary(true)} 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Library size={16} />
              Template Library
            </button>
            <button 
              onClick={create} 
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={16} />
              New Template
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map(template => (
          <div key={template.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {CATEGORY_ICONS[template.category] || "📝"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-500">{template.language} • {template.category}</p>
                  </div>
                </div>
                <StatusBadge status={template.status} />
              </div>

              <div className="text-sm text-gray-600 mb-4 line-clamp-3">
                {template.components?.body?.text || "No content"}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing({ id: template.id, ...template }); setOpenEditor(true); }}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit template"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => setShowPreview(showPreview === template.id ? null : template.id)}
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Preview template"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => remove(template.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <button
                  onClick={() => submitForApproval(template.id)}
                  disabled={busy || template.status === "PENDING" || template.status === "APPROVED"}
                  className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <Send size={14} />
                  Submit
                </button>
              </div>

              {/* Preview */}
              {showPreview === template.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {renderTemplatePreview(template)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'No templates found' : 'No templates yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Create your first WhatsApp template to get started with messaging.'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button 
              onClick={create} 
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={16} />
              Create First Template
            </button>
          )}
        </div>
      )}

      {/* Template Editor Modal */}
      {openEditor && (
        <WhatsAppTemplateEditor
          open={openEditor}
          initial={editing}
          onClose={() => { setOpenEditor(false); setEditing(null); }}
          onSave={onSave}
        />
      )}

      {/* Template Library Modal */}
      <TemplateLibrary
        isOpen={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        onSelectTemplate={handleTemplateSelection}
      />
    </div>
  );
}