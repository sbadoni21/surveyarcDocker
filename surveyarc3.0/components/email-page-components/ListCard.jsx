import { LoadingOverlay } from "@/utils/loadingOverlay";
import { Copy, Edit, ListIcon, MoreVertical, Pause, Play, Plus, Trash2, Users, UserX } from "lucide-react";

/* ------------------------------ Components ------------------------------ */
export const ListCard = ({
  list,
  onSelect,
  onStatusToggle,
  onEdit,
  onDelete,
  isSelected,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  contactCount,
  dragMode,
  isLoading = false,
  isUpdating = false,
}) => (
  <div
    className={`
      p-4 bg-white border rounded-lg transition-all cursor-pointer relative
      ${isSelected ? "ring-2 ring-orange-500 bg-orange-50 border-orange-300" : "hover:shadow-md hover:border-gray-300"}
      ${isDragOver ? "ring-2 ring-green-500 bg-green-50 border-green-300" : ""}
      ${list.isSpecial ? "border-l-4 border-l-orange-500" : ""}
      ${isLoading || isUpdating ? "opacity-50 pointer-events-none" : ""}
    `}
    onClick={() => !isLoading && !isUpdating && onSelect(list.id)}
    onDragOver={!isLoading && !isUpdating ? onDragOver : undefined}
    onDragLeave={!isLoading && !isUpdating ? onDragLeave : undefined}
    onDrop={!isLoading && !isUpdating ? (e) => onDrop(e, list.id) : undefined}
  >
    {(isLoading || isUpdating) && <LoadingOverlay message={isUpdating ? "Updating..." : "Loading..."} />}
    
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {list.id === "all" && <Users className="w-4 h-4 text-orange-600" />}
          {list.id === "unassigned" && <UserX className="w-4 h-4 text-orange-600" />}
          {!list.isSpecial && <ListIcon className="w-4 h-4 text-gray-600" />}
          <h3 className="font-semibold text-gray-900 truncate">{list.name}</h3>
        </div>
        <p className="text-sm text-gray-600">{contactCount} contacts</p>
      </div>
      <div className="flex items-center gap-2 ml-2">
        {!list.isSpecial && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isLoading && !isUpdating) onStatusToggle(list.id);
            }}
            disabled={isLoading || isUpdating}
            className={`
              px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 disabled:opacity-50
              ${list.status === "live" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
            `}
          >
            {isUpdating ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                {list.status === "live" ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                {list.status}
              </>
            )}
          </button>
        )}
        {!list.isSpecial && (
          <div className="relative group">
            <button
              onClick={(e) => e.stopPropagation()}
              disabled={isLoading || isUpdating}
              className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-8 w-32 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isLoading && !isUpdating) onEdit(list.id);
                }}
                disabled={isLoading || isUpdating}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isLoading && !isUpdating) onDelete(list.id);
                }}
                disabled={isLoading || isUpdating}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    {isDragOver && !isLoading && !isUpdating && (
      <div className="absolute inset-0 bg-green-500 bg-opacity-10 rounded-lg flex items-center justify-center border-2 border-green-300 border-dashed">
        <div className="text-center">
          {list.id === "unassigned" ? (
            <UserX className="w-6 h-6 mx-auto text-orange-600 mb-1" />
          ) : dragMode === "copy" ? (
            <Copy className="w-6 h-6 mx-auto text-green-600 mb-1" />
          ) : (
            <Plus className="w-6 h-6 mx-auto text-green-600 mb-1" />
          )}
          <p className="text-sm font-medium text-green-700">
            {list.id === "unassigned" 
              ? "Drop to remove from all lists"
              : dragMode === "copy" 
                ? "Drop to copy to list" 
                : "Drop to add to list"}
          </p>
        </div>
      </div>
    )}
  </div>
);