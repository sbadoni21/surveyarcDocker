import React from "react";

export default function SavedListSidebar({
  lists,
  selectedListId, // ⚡️ now an array (selectedListIds)
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onViewAllContacts,
}) {
  return (
    <div className="w-64 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Saved Lists</h3>
        <button
          onClick={onCreate}
          className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {lists.length === 0 ? (
          <p className="text-gray-500 text-sm">No lists yet</p>
        ) : (
          <ul className="space-y-2">
            {lists.map((list) => (
              <li
                key={list.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${
                  selectedListId.includes(list.id)
                    ? "bg-blue-50 border border-blue-400"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedListId.includes(list.id)}
                  onChange={() => onSelect(list.id)} // toggle handled in parent
                  className="h-4 w-4"
                />
                <span className="flex-1 text-sm">{list.listName}</span>
                <button
                  onClick={() => onRename(list.id)}
                  className="text-xs text-gray-500 hover:text-black"
                >
                  ✎
                </button>
                <button
                  onClick={() => onDelete(list.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onViewAllContacts}
        className="mt-4 w-full px-3 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300"
      >
        View All Contacts
      </button>
    </div>
  );
}
