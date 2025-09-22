import { CheckCircle, Copy, GripVertical, Move, Trash2, X } from "lucide-react";
import React from "react";

export const ContactRow = ({
  contact,
  onSelect,
  isSelected,
  isDragging,
  onDragStart,
  onDragEnd,
  isInSelectedList,
  dragMode,
  selectedContactsCount,
  listNames,
  isLoading = false,
  onDeleteSingle,
})  => (
  <tr
    draggable={!isLoading}
    onDragStart={!isLoading ? (e) => onDragStart(e, contact) : undefined}
    onDragEnd={!isLoading ? onDragEnd : undefined}
    className={`
      transition-all cursor-pointer border-b hover:bg-gray-50
      ${isSelected ? "bg-orange-50 border-orange-200" : ""}
      ${isDragging ? "opacity-50" : ""}
      ${isInSelectedList ? "bg-orange-25" : ""}
      ${isLoading ? "opacity-50 pointer-events-none" : ""}
    `}
    onClick={() => !isLoading && onSelect(contact.id)}
  >
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => !isLoading && onSelect(contact.id)}
          onClick={(e) => e.stopPropagation()}
          disabled={isLoading}
          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
        />
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="font-medium text-gray-900">{contact.name || "—"}</div>
    </td>
    <td className="px-4 py-3">
      <div className="text-gray-600">{contact.email}</div>
    </td>
    <td className="px-4 py-3">
      <span
        className={`
        px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1
        ${
          contact.status === "bounced"
            ? "bg-red-100 text-red-800"
            : contact.status === "unsubscribed"
            ? "bg-gray-100 text-gray-800"
            : "bg-green-100 text-green-800"
        }
      `}
      >
        {contact.status === "active" && <CheckCircle className="w-3 h-3" />}
        {contact.status === "bounced" && <X className="w-3 h-3" />}
        {contact.status === "unsubscribed" && <X className="w-3 h-3" />}
        {contact.status || "active"}
      </span>
    </td>
    <td className="px-4 py-3">
      <div className="flex flex-wrap gap-1">
        {contact.listIds && contact.listIds.length > 0 ? (
          contact.listIds.map((listId) => (
            <span
              key={listId}
              className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium"
            >
              {listNames[listId] || listId}
            </span>
          ))
        ) : (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
            Unassigned
          </span>
        )}
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-gray-500">
      {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : "—"}
    </td>
    <td className="px-4 py-3">
      <button
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          const ask = `Delete "${contact.name || contact.email}"? This removes from all lists and deletes permanently.`;
          if (!confirm(ask)) return;
          onDeleteSingle(contact.id);
        }}
        className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
        title="Delete contact"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </td>
    {isDragging && !isLoading && (
      <td className="absolute inset-0 bg-orange-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-1 text-orange-600">
          {dragMode === "copy" ? <Copy className="w-4 h-4" /> : <Move className="w-4 h-4" />}
          <span className="text-xs font-medium">
            {dragMode === "copy" ? "Copy" : selectedContactsCount > 1 ? "Move" : "Add"}
            {selectedContactsCount > 1 && ` (${selectedContactsCount})`}
          </span>
        </div>
      </td>
    )}
  </tr>
);