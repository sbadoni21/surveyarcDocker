"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  List as ListIcon,
  Upload,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Users,

  AlertCircle,
  CheckCircle,
  X,
  Mail,
  Move,
  GripVertical,
  Copy,
  UserX,
  Info,
  MousePointer,
  ArrowUpDown,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
} from "lucide-react";
import {
  collection, getDocs, setDoc, updateDoc, doc,
  arrayUnion, arrayRemove, limit as qLimit,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";
import { slugify } from "@/utils/emailTemplates";
import { LoadingSpinner } from "@/utils/loadingSpinner";
import { ListCard } from "./email-page-components/ListCard";
import { UploadModal } from "./email-page-components/UploadContacts";
import { ContactRow } from "./email-page-components/ContactRow";
import { LoadingOverlay } from "@/utils/loadingOverlay";



const findContactByEmail = async (orgId, email) => {
  const snap = await getDocs(collection(db, "organizations", orgId, "contacts"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((c) => c.email === email);
};

const upsertContacts = async (orgId, contacts) => {
  const ids = [];
  for (const c of contacts) {
    if (!c.email) continue;
    const existing = await findContactByEmail(orgId, c.email);
    if (existing) {
      await updateDoc(doc(db, "organizations", orgId, "contacts", existing.id), c);
      ids.push(existing.id);
    } else {
      const newRef = doc(collection(db, "organizations", orgId, "contacts"));
      await setDoc(newRef, c);
      ids.push(newRef.id);
    }
  }
  return ids;
};

const upsertListWithContacts = async (orgId, name, contacts) => {
  const contactIds = await upsertContacts(orgId, contacts);
  const listId = slugify(name);
  await setDoc(doc(db, "organizations", orgId, "lists", listId), {
    listName: name,
    contactIds,
    createdAt: Date.now(),
  });
  return listId;
};

/* --------------------------- pagination hook --------------------------- */
const usePagination = (data, itemsPerPage = 20) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);
  
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);
  
  return {
    currentPage,
    totalPages,
    paginatedData,
    setCurrentPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
};



const SkeletonRow = () => (
  <tr className="border-b">
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        <div className="w-3 h-3 bg-gray-200 rounded animate-pulse" />
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
    </td>
    <td className="px-4 py-3">
      <div className="w-48 h-4 bg-gray-200 rounded animate-pulse" />
    </td>
    <td className="px-4 py-3">
      <div className="w-16 h-6 bg-gray-200 rounded-full animate-pulse" />
    </td>
    <td className="px-4 py-3">
      <div className="flex gap-1">
        <div className="w-12 h-6 bg-gray-200 rounded animate-pulse" />
        <div className="w-16 h-6 bg-gray-200 rounded animate-pulse" />
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
    </td>
    <td className="px-4 py-3">
      <div className="w-16 h-6 bg-gray-200 rounded animate-pulse" />
    </td>
  </tr>
);

const SkeletonListCard = () => (
  <div className="p-4 bg-white border rounded-lg animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="w-24 h-4 bg-gray-200 rounded" />
        </div>
        <div className="w-16 h-3 bg-gray-200 rounded" />
      </div>
      <div className="w-12 h-6 bg-gray-200 rounded-full" />
    </div>
  </div>
);

const SortableHeader = ({ children, sortKey, currentSort, onSort, isLoading }) => (
  <th
    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider transition-colors
      ${isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-100"}
    `}
    onClick={() => !isLoading && onSort(sortKey)}
  >
    <div className="flex items-center gap-1">
      {children}
      {!isLoading && currentSort.key === sortKey && (
        currentSort.direction === "asc" ? 
          <SortAsc className="w-3 h-3" /> : 
          <SortDesc className="w-3 h-3" />
      )}
      {!isLoading && currentSort.key !== sortKey && <ArrowUpDown className="w-3 h-3 opacity-50" />}
    </div>
  </th>
);

const FilterDropdown = ({ label, options, selected, onSelect, icon: Icon, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors disabled:opacity-50
          ${selected.length > 0 ? "bg-orange-50 border-orange-300 text-orange-700" : "hover:bg-gray-50"}
        `}
      >
        {isLoading ? <LoadingSpinner size="sm" /> : <Icon className="w-4 h-4" />}
        {label}
        {selected.length > 0 && (
          <span className="bg-orange-600 text-white rounded-full px-2 py-0.5 text-xs">
            {selected.length}
          </span>
        )}
      </button>
      {isOpen && !isLoading && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
          <div className="p-2 max-h-60 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelect([...selected, option.value]);
                    } else {
                      onSelect(selected.filter(v => v !== option.value));
                    }
                  }}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-gray-500 ml-auto">({option.count})</span>
              </label>
            ))}
          </div>
          <div className="border-t p-2">
            <button
              onClick={() => {
                onSelect([]);
                setIsOpen(false);
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DragModeIndicator = ({ dragMode }) => (
  <div className="fixed top-4 right-4 z-50 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-lg">
    <div className="flex items-center gap-2 text-sm">
      {dragMode === "copy" ? (
        <>
          <Copy className="w-4 h-4 text-orange-600" />
          <span className="font-medium">Copy Mode</span>
          <span className="text-gray-500">(Hold Ctrl/Cmd)</span>
        </>
      ) : (
        <>
          <Move className="w-4 h-4 text-orange-600" />
          <span className="font-medium">Add Mode</span>
          <span className="text-gray-500">(Default)</span>
        </>
      )}
    </div>
  </div>
);

const Pagination = ({ currentPage, totalPages, onPageChange, hasNext, hasPrev, totalItems, itemsPerPage, isLoading }) => (
  <div className="flex items-center justify-between bg-white px-4 py-3 border-t">
    <div className="text-sm text-gray-700">
      {isLoading ? (
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          Loading contacts...
        </div>
      ) : (
        `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} contacts`
      )}
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrev || isLoading}
        className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-3 py-1 text-sm">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext || isLoading}
        className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

/* ------------------------------ Notification ------------------------------ */
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className={`
        px-4 py-2 rounded-lg shadow-lg flex items-center gap-2
        ${type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}
      `}>
        {type === 'error' ? <X className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-75">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ------------------------------ Main ------------------------------ */
export default function EmailManagementFirestore() {
  const { orgId, } = useRouteParams();
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  // Data states
  const [contactsRaw, setContactsRaw] = useState([]);
  const [listsRaw, setListsRaw] = useState([]);
  const [selectedListId, setSelectedListId] = useState("all");

  // UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [statusFilter, setStatusFilter] = useState([]);
  const [listFilter, setListFilter] = useState([]);

  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [isListsLoading, setIsListsLoading] = useState(false);
  const [isDragOperationLoading, setIsDragOperationLoading] = useState(false);
  const [isBulkOperationLoading, setIsBulkOperationLoading] = useState(false);
  const [updatingListIds, setUpdatingListIds] = useState(new Set());

  // Modal states
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Drag states
  const [draggedContact, setDraggedContact] = useState(null);
  const [dragOverListId, setDragOverListId] = useState(null);
  const [dragMode, setDragMode] = useState("move");
  const [isDragging, setIsDragging] = useState(false);

  /* ------------------------------ data fetching ------------------------------ */
  const fetchLists = useCallback(async (showLoading = true) => {
    if (showLoading) setIsListsLoading(true);
    try {
      const snap = await getDocs(collection(db, "organizations", orgId, "lists"));
      const arr = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((l) => !l.deletedAt);
      setListsRaw(
        arr.map((l) => ({
          id: l.id,
          name: l.listName || l.name || l.id,
          status: l.status || "live",
          contactIds: Array.isArray(l.contactIds) ? l.contactIds : [],
          createdAt: l.createdAt || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching lists:", error);
      setNotification({
        message: "Error loading lists. Please refresh the page.",
        type: "error"
      });
    } finally {
      if (showLoading) setIsListsLoading(false);
    }
  }, [orgId]);

  const fetchAllContacts = useCallback(async (showLoading = true) => {
    if (showLoading) setIsContactsLoading(true);
    try {
      const snap = await getDocs(collection(db, "organizations", orgId, "contacts"));
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setContactsRaw(
        arr.map((c) => ({
          id: c.id,
          name: c.name || "",
          email: c.email || "",
          status: c.status || "active",
          createdAt: c.createdAt || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setNotification({
        message: "Error loading contacts. Please refresh the page.",
        type: "error"
      });
    } finally {
      if (showLoading) setIsContactsLoading(false);
    }
  }, [orgId]);

  const refreshData = useCallback(async () => {
    setIsInitialLoading(true);
    try {
      await Promise.all([
        fetchLists(false),
        fetchAllContacts(false)
      ]);
    } finally {
      setIsInitialLoading(false);
    }
  }, [fetchLists, fetchAllContacts]);

  useEffect(() => {
    if (!orgId) return;
    refreshData();
  }, [orgId, refreshData]);

  /* ------------------------------ computed data ------------------------------ */
  /** Build a contactId -> listIds[] map from list.contactIds arrays */
  const contactToLists = useMemo(() => {
    const map = new Map();
    listsRaw.forEach((l) => {
      (l.contactIds || []).forEach((cid) => {
        if (!map.has(cid)) map.set(cid, []);
        map.get(cid).push(l.id);
      });
    });
    return map;
  }, [listsRaw]);

  /** List names lookup */
  const listNames = useMemo(() => {
    const names = {};
    listsRaw.forEach(list => {
      names[list.id] = list.name;
    });
    return names;
  }, [listsRaw]);

  /** contacts shaped for UI with derived listIds */
  const contacts = useMemo(
    () =>
      contactsRaw.map((c) => ({
        ...c,
        listIds: contactToLists.get(c.id) || [],
      })),
    [contactsRaw, contactToLists]
  );

  /** UI lists with All + Unassigned */
  const uiLists = useMemo(() => {
    const contactsInLists = new Set();
    listsRaw.forEach(list => {
      (list.contactIds || []).forEach(contactId => {
        contactsInLists.add(contactId);
      });
    });
    
    const unassignedCount = contactsRaw.filter(contact => !contactsInLists.has(contact.id)).length;
    return [
      { 
        id: "all", 
        name: "All Contacts", 
        isSpecial: true, 
        status: "live", 
        contactCount: contactsRaw.length 
      },
      {
        id: "unassigned",
        name: "Unassigned Contacts",
        isSpecial: true,
        status: "live",
        contactCount: unassignedCount,
      },
      ...listsRaw.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        isSpecial: false,
        contactCount: (l.contactIds || []).length,
      })),
    ];
  }, [contactsRaw, listsRaw]);

  /* ------------------------------ filtering/sorting/pagination ------------------------------ */
  const filteredAndSortedContacts = useMemo(() => {
    let arr = contacts;
    
    // List filtering
    if (selectedListId === "unassigned") {
      arr = arr.filter((c) => (c.listIds || []).length === 0);
    } else if (selectedListId !== "all") {
      arr = arr.filter((c) => (c.listIds || []).includes(selectedListId));
    }
    
    // Search filtering
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter((c) => 
        c.name.toLowerCase().includes(q) || 
        c.email.toLowerCase().includes(q)
      );
    }
    
    // Status filtering
    if (statusFilter.length > 0) {
      arr = arr.filter((c) => statusFilter.includes(c.status || "active"));
    }
    
    // List membership filtering
    if (listFilter.length > 0) {
      arr = arr.filter((c) => {
        if (listFilter.includes("unassigned")) {
          return c.listIds.length === 0 || c.listIds.some(id => listFilter.includes(id));
        }
        return c.listIds.some(id => listFilter.includes(id));
      });
    }
    
    // Sorting
    if (sortConfig.key) {
      arr.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === "listCount") {
          aVal = a.listIds.length;
          bVal = b.listIds.length;
        }
        
        if (typeof aVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    return arr;
  }, [contacts, selectedListId, searchQuery, statusFilter, listFilter, sortConfig]);

  const pagination = usePagination(filteredAndSortedContacts, 20);

  /* ------------------------------ filter options ------------------------------ */
  const statusOptions = useMemo(() => {
    const statusCounts = {};
    contacts.forEach(c => {
      const status = c.status || "active";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      value: status,
      label: status.charAt(0).toUpperCase() + status.slice(1),
      count
    }));
  }, [contacts]);

  const listOptions = useMemo(() => {
    const listCounts = { unassigned: 0 };
    
    // Count unassigned
    contacts.forEach(c => {
      if (c.listIds.length === 0) {
        listCounts.unassigned++;
      }
    });
    
    // Count list memberships
    listsRaw.forEach(list => {
      listCounts[list.id] = (list.contactIds || []).length;
    });
    
    const options = [
      { value: "unassigned", label: "Unassigned", count: listCounts.unassigned }
    ];
    
    listsRaw.forEach(list => {
      options.push({
        value: list.id,
        label: list.name,
        count: listCounts[list.id] || 0
      });
    });
    
    return options.filter(option => option.count > 0);
  }, [contacts, listsRaw]);

  /* ------------------------------ Helper functions moved inside component ------------------------------ */
  /** Delete contacts after cleaning them from all lists */
  const deleteContactsAndCleanup = useCallback(async (contactIds) => {
    const ids = Array.isArray(contactIds) ? contactIds : [contactIds];
    
    // 1) Remove from every list
    for (const list of listsRaw) {
      const listRef = doc(db, "organizations", orgId, "lists", list.id);
      const hasAny = ids.some(id => (list.contactIds || []).includes(id));
      if (hasAny) {
        // arrayRemove per id ensures idempotency
        for (const id of ids) {
          await updateDoc(listRef, { contactIds: arrayRemove(id) });
        }
      }
    }
    
    // 2) Delete contact docs
    for (const id of ids) {
      const contactRef = doc(db, "organizations", orgId, "contacts", id);
      await deleteDoc(contactRef);
    }
  }, [listsRaw, orgId]);

  /** Bulk assign selected to a target list (non-special) */
  const bulkAssignToList = useCallback(async (targetListId) => {
    if (!targetListId || targetListId === "all" || targetListId === "unassigned") return;
    
    setIsBulkOperationLoading(true);
    try {
      await addContactsToList(selectedContacts, targetListId);
      setSelectedContacts([]);
      await fetchLists(false);
      setNotification({
        message: `Assigned ${selectedContacts.length} contact(s) to ${listNames[targetListId] || targetListId}`,
        type: "success"
      });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Error assigning contacts", type: "error" });
    } finally {
      setIsBulkOperationLoading(false);
    }
  }, [selectedContacts, listNames, fetchLists]);

  /* ------------------------------ list actions ------------------------------ */
  const handleListStatusToggle = async (listId) => {
    setUpdatingListIds(prev => new Set(prev).add(listId));
    try {
      const l = listsRaw.find((x) => x.id === listId);
      if (!l) return;
      const next = l.status === "live" ? "suspended" : "live";
      await updateDoc(doc(db, "organizations", orgId, "lists", listId), { status: next });
      setListsRaw((prev) => prev.map((x) => (x.id === listId ? { ...x, status: next } : x)));
      setNotification({
        message: `List ${next === "live" ? "activated" : "suspended"}`,
        type: "success"
      });
    } catch (error) {
      console.error("Error updating list status:", error);
      setNotification({
        message: "Error updating list status",
        type: "error"
      });
    } finally {
      setUpdatingListIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(listId);
        return newSet;
      });
    }
  };

  const handleListEdit = async (listId) => {
    const l = listsRaw.find((x) => x.id === listId);
    const newName = prompt("Enter new list name:", l?.name || "");
    if (!newName || newName.trim() === l?.name) return;
    
    setUpdatingListIds(prev => new Set(prev).add(listId));
    try {
      await updateDoc(doc(db, "organizations", orgId, "lists", listId), {
        listName: newName.trim(),
        updatedAt: Date.now(),
      });
      setListsRaw((prev) => prev.map((x) => (x.id === listId ? { ...x, name: newName.trim() } : x)));
      setNotification({
        message: "List name updated successfully",
        type: "success"
      });
    } catch (error) {
      console.error("Error updating list name:", error);
      setNotification({
        message: "Error updating list name",
        type: "error"
      });
    } finally {
      setUpdatingListIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(listId);
        return newSet;
      });
    }
  };

  const handleListDelete = async (listId) => {
    if (!confirm("Delete this list? Contacts remain in database.")) return;
    
    setUpdatingListIds(prev => new Set(prev).add(listId));
    try {
      await updateDoc(doc(db, "organizations", orgId, "lists", listId), { deletedAt: Date.now() });
      await fetchLists(false);
      setNotification({
        message: "List deleted successfully",
        type: "success"
      });
    } catch (error) {
      console.error("Error deleting list:", error);
      setNotification({
        message: "Error deleting list",
        type: "error"
      });
    } finally {
      setUpdatingListIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(listId);
        return newSet;
      });
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  /* ------------------------------ contact operations ------------------------------ */
  const removeContactsFromAllLists = async (contactIds) => {
    const contactIdsArray = Array.isArray(contactIds) ? contactIds : [contactIds];
    
    for (const list of listsRaw) {
      const hasAnyContact = contactIdsArray.some(cid => (list.contactIds || []).includes(cid));
      if (hasAnyContact) {
        const listRef = doc(db, "organizations", orgId, "lists", list.id);
        for (const contactId of contactIdsArray) {
          await updateDoc(listRef, { contactIds: arrayRemove(contactId) });
        }
      }
    }
  };

  const addContactsToList = async (contactIds, listId) => {
    const contactIdsArray = Array.isArray(contactIds) ? contactIds : [contactIds];
    const listRef = doc(db, "organizations", orgId, "lists", listId);
    
    for (const contactId of contactIdsArray) {
      await updateDoc(listRef, { contactIds: arrayUnion(contactId) });
    }
  };

  const removeContactsFromList = async (contactIds, listId) => {
    const contactIdsArray = Array.isArray(contactIds) ? contactIds : [contactIds];
    const listRef = doc(db, "organizations", orgId, "lists", listId);
    
    for (const contactId of contactIdsArray) {
      await updateDoc(listRef, { contactIds: arrayRemove(contactId) });
    }
  };

  /* ------------------------------ drag & drop ------------------------------ */
  useEffect(() => {
    const down = (e) => {
      if (e.ctrlKey || e.metaKey) setDragMode("copy");
    };
    const up = (e) => {
      if (!e.ctrlKey && !e.metaKey) setDragMode("move");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handleDragStart = (e, contact) => {
    if (isDragOperationLoading) return;
    
    setDraggedContact(contact);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = dragMode === "copy" ? "copy" : "move";
    
    if (!selectedContacts.includes(contact.id)) {
      setSelectedContacts([contact.id]);
    }
  };

  const handleDragEnd = () => {
    setDraggedContact(null);
    setDragOverListId(null);
    setIsDragging(false);
  };

  const handleDragOver = (e, listId) => {
    if (isDragOperationLoading) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragMode === "copy" ? "copy" : "move";
    setDragOverListId(listId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverListId(null);
  };

  const handleDrop = async (e, targetListId) => {
    e.preventDefault();
    setDragOverListId(null);
    if (!draggedContact || isDragOperationLoading) return;
    
    const contactsToMove = selectedContacts.length > 1 && selectedContacts.includes(draggedContact.id)
      ? selectedContacts
      : [draggedContact.id];
    
    setIsDragOperationLoading(true);
    
    try {
      // Check if contacts already exist in the target list
      if (targetListId !== "all" && targetListId !== "unassigned") {
        const targetList = listsRaw.find(l => l.id === targetListId);
        const existingContacts = contactsToMove.filter(cid => 
          (targetList?.contactIds || []).includes(cid)
        );
        
        if (existingContacts.length > 0) {
          const contactNames = existingContacts
            .map(cid => contacts.find(c => c.id === cid)?.name || "Unknown")
            .join(", ");
          
          setNotification({
            message: `Contact(s) already in list: ${contactNames}`,
            type: "error"
          });
          return;
        }
      }
      
      if (targetListId === "all") {
        setNotification({
          message: "Cannot drop to 'All Contacts' - it's a view of all contacts",
          type: "error"
        });
        return;
      }
      
      if (targetListId === "unassigned") {
        await removeContactsFromAllLists(contactsToMove);
        setNotification({
          message: `Removed ${contactsToMove.length} contact(s) from all lists`,
          type: "success"
        });
      } else {
        // When dragging from "All Contacts", always add to list (don't remove from other lists)
        const isFromAllContacts = selectedListId === "all";
        
        if (dragMode === "copy" || isFromAllContacts) {
          await addContactsToList(contactsToMove, targetListId);
          setNotification({
            message: `Added ${contactsToMove.length} contact(s) to ${listNames[targetListId]}`,
            type: "success"
          });
        } else {
          // Move mode from specific list: remove from all lists first, then add to target
          await removeContactsFromAllLists(contactsToMove);
          await addContactsToList(contactsToMove, targetListId);
          setNotification({
            message: `Moved ${contactsToMove.length} contact(s) to ${listNames[targetListId]}`,
            type: "success"
          });
        }
      }
      
      setSelectedContacts([]);
      await fetchLists(false);
    } catch (error) {
      console.error("Error in drag operation:", error);
      setNotification({
        message: "Error updating contacts. Please try again.",
        type: "error"
      });
    } finally {
      setDraggedContact(null);
      setIsDragging(false);
      setIsDragOperationLoading(false);
    }
  };

  /* ------------------------------ bulk operations ------------------------------ */
  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;
    const confirmMsg = `Delete ${selectedContacts.length} contact(s)? This will remove them from all lists and delete permanently.`;
    if (!confirm(confirmMsg)) return;
    
    setIsBulkOperationLoading(true);
    setIsDeleteLoading(true);
    try {
      await deleteContactsAndCleanup(selectedContacts);
      setSelectedContacts([]);
      await Promise.all([fetchAllContacts(false), fetchLists(false)]);
      setNotification({ message: "Contact(s) deleted", type: "success" });
    } catch (e) {
      console.error(e);
      setNotification({ message: "Error deleting contacts", type: "error" });
    } finally {
      setIsDeleteLoading(false);
      setIsBulkOperationLoading(false);
    }
  };

  const handleBulkRemoveFromList = async () => {
    if (selectedListId === "all" || selectedListId === "unassigned") return;
    if (!confirm(`Remove ${selectedContacts.length} contacts from this list?`)) return;
    
    setIsBulkOperationLoading(true);
    try {
      await removeContactsFromList(selectedContacts, selectedListId);
      setSelectedContacts([]);
      await fetchLists(false);
      setNotification({
        message: `Removed ${selectedContacts.length} contact(s) from list`,
        type: "success"
      });
    } catch (error) {
      console.error("Error removing contacts from list:", error);
      setNotification({
        message: "Error removing contacts from list",
        type: "error"
      });
    } finally {
      setIsBulkOperationLoading(false);
    }
  };

  const handleBulkMakeUnassigned = async () => {
    if (!confirm(`Remove ${selectedContacts.length} contacts from all lists?`)) return;
    
    setIsBulkOperationLoading(true);
    try {
      await removeContactsFromAllLists(selectedContacts);
      setSelectedContacts([]);
      await fetchLists(false);
      setNotification({
        message: `Removed ${selectedContacts.length} contact(s) from all lists`,
        type: "success"
      });
    } catch (error) {
      console.error("Error making contacts unassigned:", error);
      setNotification({
        message: "Error making contacts unassigned",
        type: "error"
      });
    } finally {
      setIsBulkOperationLoading(false);
    }
  };

  const handleUpload = async ({ listName, contacts }) => {
    try {
      await upsertListWithContacts(orgId, listName, contacts);
      await refreshData();
      setSelectedListId(slugify(listName));
      setNotification({
        message: `Successfully created list "${listName}" with ${contacts.length} contacts`,
        type: "success"
      });
    } catch (error) {
      console.error("Error uploading contacts:", error);
      setNotification({
        message: "Error uploading contacts. Please try again.",
        type: "error"
      });
      throw error; // Re-throw to let the modal handle it
    }
  };

  const openCampaignModal = () => {
    alert("Hook your existing campaign modal here.");
  };

  const handleContactSelect = (contactId) => {
    if (isDragOperationLoading || isBulkOperationLoading) return;
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (isDragOperationLoading || isBulkOperationLoading) return;
    if (selectedContacts.length === filteredAndSortedContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredAndSortedContacts.map(c => c.id));
    }
  };

  const selectedList = uiLists.find((l) => l.id === selectedListId);
  const isAnyOperationLoading = isInitialLoading || isContactsLoading || isListsLoading || isDragOperationLoading || isBulkOperationLoading;

  // If we don't have orgId, show a message
  if (!orgId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Organization not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notifications */}
      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">Email Management</h1>
              {isInitialLoading && (
                <div className="flex items-center gap-2 text-gray-500">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Loading...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshData}
                disabled={isAnyOperationLoading}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${isInitialLoading ? "animate-spin" : ""}`} />
              </button>
              
              <button
                onClick={() => setUploadModalOpen(true)}
                disabled={isAnyOperationLoading}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Upload List
              </button>
              
              <button
                onClick={openCampaignModal}
                disabled={isAnyOperationLoading}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                Send Campaign
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drag Mode Indicator */}
      {isDragging && <DragModeIndicator dragMode={selectedListId === "all" ? "copy" : dragMode} />}

      {/* Instructions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-orange-600 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p>
                <strong>Drag & Drop:</strong> From "All Contacts": <strong>Adds</strong> to lists (keeps existing assignments). 
                From specific lists: <strong>Move</strong> (removes from all, adds to target) or hold <strong>Ctrl/Cmd</strong> for <strong>Copy</strong>.
                Drop to <strong>Unassigned</strong> to remove from all lists.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          {/* Lists Sidebar */}
          <div className="col-span-3 bg-white rounded-lg border overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ListIcon className="w-5 h-5" />
                Lists
                {isListsLoading && <LoadingSpinner size="sm" />}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isInitialLoading ? (
                // Skeleton loading for lists
                Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonListCard key={i} />
                ))
              ) : (
                uiLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    contactCount={list.contactCount}
                    isSelected={selectedListId === list.id}
                    isDragOver={dragOverListId === list.id}
                    onSelect={setSelectedListId}
                    onStatusToggle={handleListStatusToggle}
                    onEdit={handleListEdit}
                    onDelete={handleListDelete}
                    onDragOver={(e) => handleDragOver(e, list.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    dragMode={selectedListId === "all" ? "copy" : dragMode}
                    isLoading={isInitialLoading}
                    isUpdating={updatingListIds.has(list.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Contacts Area */}
          <div className="col-span-9 bg-white rounded-lg border overflow-hidden flex flex-col">
            {/* Contacts Header */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {selectedList?.id === "all" && <Users className="w-5 h-5" />}
                    {selectedList?.id === "unassigned" && <UserX className="w-5 h-5" />}
                    {!selectedList?.isSpecial && <ListIcon className="w-5 h-5" />}
                    {selectedList?.name || "All Contacts"}
                    {isContactsLoading && <LoadingSpinner size="sm" />}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {isInitialLoading ? "Loading..." : `${filteredAndSortedContacts.length} contacts`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    disabled={isAnyOperationLoading || filteredAndSortedContacts.length === 0}
                    className="flex items-center gap-2 px-3 py-1 border rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
                  >
                    <MousePointer className="w-4 h-4" />
                    {selectedContacts.length === filteredAndSortedContacts.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedContacts.length > 0 && (
                    <>
                      <span className="text-sm text-gray-600">
                        {selectedContacts.length} selected
                        {isBulkOperationLoading && <LoadingSpinner size="sm" className="ml-1" />}
                      </span>
                      
                      <button 
                        disabled={isBulkOperationLoading}
                        className="flex items-center gap-2 px-3 py-1 border rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                      
                      {selectedListId !== "all" && selectedListId !== "unassigned" && (
                        <button
                          onClick={handleBulkRemoveFromList}
                          disabled={isBulkOperationLoading}
                          className="flex items-center gap-2 px-3 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm disabled:opacity-50"
                        >
                          {isBulkOperationLoading ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                          Remove from List
                        </button>
                      )}
                      
                      <button
                        onClick={handleBulkMakeUnassigned}
                        disabled={isBulkOperationLoading}
                        className="flex items-center gap-2 px-3 py-1 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 text-sm disabled:opacity-50"
                      >
                        {isBulkOperationLoading ? <LoadingSpinner size="sm" /> : <UserX className="w-4 h-4" />}
                        Make Unassigned
                      </button>
                      
                      <button
                        onClick={handleBulkDelete}
                        disabled={isBulkOperationLoading || isDeleteLoading}
                        className="flex items-center gap-2 px-3 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm disabled:opacity-50"
                      >
                        {(isBulkOperationLoading || isDeleteLoading) ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isInitialLoading}
                    className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                  />
                </div>
                
                <FilterDropdown
                  label="Status"
                  options={statusOptions}
                  selected={statusFilter}
                  onSelect={setStatusFilter}
                  icon={Filter}
                  isLoading={isInitialLoading}
                />
                
                <FilterDropdown
                  label="Lists"
                  options={listOptions}
                  selected={listFilter}
                  onSelect={setListFilter}
                  icon={ListIcon}
                  isLoading={isInitialLoading}
                />
              </div>
            </div>

            {/* Contacts Table */}
            <div className="flex-1 overflow-auto relative">
              {isDragOperationLoading && (
                <LoadingOverlay message="Updating contacts..." />
              )}
              
              {isInitialLoading ? (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-16">
                        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lists</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </tbody>
                </table>
              ) : filteredAndSortedContacts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {selectedListId === "unassigned" ? (
                    <>
                      <UserX className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No unassigned contacts</p>
                      <p className="text-sm">All contacts belong to a list</p>
                    </>
                  ) : (
                    <>
                      <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No contacts found</p>
                      {searchQuery && <p className="text-sm">Try adjusting your search terms</p>}
                    </>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-16">
                        <input
                          type="checkbox"
                          checked={selectedContacts.length === filteredAndSortedContacts.length && filteredAndSortedContacts.length > 0}
                          onChange={handleSelectAll}
                          disabled={isAnyOperationLoading}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                        />
                      </th>
                      <SortableHeader 
                        sortKey="name" 
                        currentSort={sortConfig} 
                        onSort={handleSort}
                        isLoading={isAnyOperationLoading}
                      >
                        Name
                      </SortableHeader>
                      <SortableHeader 
                        sortKey="email" 
                        currentSort={sortConfig} 
                        onSort={handleSort}
                        isLoading={isAnyOperationLoading}
                      >
                        Email
                      </SortableHeader>
                      <SortableHeader 
                        sortKey="status" 
                        currentSort={sortConfig} 
                        onSort={handleSort}
                        isLoading={isAnyOperationLoading}
                      >
                        Status
                      </SortableHeader>
                      <SortableHeader 
                        sortKey="listCount" 
                        currentSort={sortConfig} 
                        onSort={handleSort}
                        isLoading={isAnyOperationLoading}
                      >
                        Lists
                      </SortableHeader>
                      <SortableHeader 
                        sortKey="createdAt" 
                        currentSort={sortConfig} 
                        onSort={handleSort}
                        isLoading={isAnyOperationLoading}
                      >
                        Created
                      </SortableHeader>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {pagination.paginatedData.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        isSelected={selectedContacts.includes(contact.id)}
                        onSelect={handleContactSelect}
                        isDragging={draggedContact?.id === contact.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isInSelectedList={
                          selectedListId !== "all" &&
                          selectedListId !== "unassigned" &&
                          (contact.listIds || []).includes(selectedListId)
                        }
                        dragMode={selectedListId === "all" ? "copy" : dragMode}
                        selectedContactsCount={selectedContacts.length}
                        listNames={listNames}
                        isLoading={isDragOperationLoading}
                        onDeleteSingle={async (id) => {
                          setIsDragOperationLoading(true);
                          try {
                            await deleteContactsAndCleanup(id);
                            await Promise.all([fetchAllContacts(false), fetchLists(false)]);
                            setNotification({ message: "Contact deleted", type: "success" });
                          } catch (e) {
                            console.error(e);
                            setNotification({ message: "Error deleting contact", type: "error" });
                          } finally {
                            setIsDragOperationLoading(false);
                          }
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {!isInitialLoading && filteredAndSortedContacts.length > 0 && (
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setCurrentPage}
                hasNext={pagination.hasNext}
                hasPrev={pagination.hasPrev}
                totalItems={filteredAndSortedContacts.length}
                itemsPerPage={20}
                isLoading={isContactsLoading}
              />
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}