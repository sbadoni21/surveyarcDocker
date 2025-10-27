// ============================================================
// FILE: components/tickets/agent/CommentItem.jsx
// ============================================================
"use client";
import { User as UserIcon, Lock, Trash2 } from "lucide-react";
import CommentModel from "@/models/postGresModels/commentModel";

export default function CommentItem({ comment, currentUserId, onDelete, author }) {
  const commentId = comment.comment_id || comment.commentId;
  const authorId = comment.author_id || comment.authorId;
  const createdAt = comment.created_at || comment.createdAt;
  const isOwn = authorId === currentUserId;
  const isInternal = comment.is_internal || comment.isInternal;
  const isMine = (comment.author_id || comment.authorId) === currentUserId;

  // Tweak these according to your user model’s fields
  const displayName =
    author?.display_name ||
    author?.name ||
    author?.full_name ||
    author?.email ||
    author?.username ||
    (comment.author_id || comment.authorId);

  const displayEmail = author?.email;
  const handleDelete = async () => {
    if (!confirm("Delete this comment?")) return;
    try {
      await CommentModel.remove(comment.ticket_id || comment.ticketId, commentId);
      onDelete?.(commentId);
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment.");
    }
  };

  return (
    <li className={`p-4 ${isInternal ? "bg-yellow-50/50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-gray-600" />
          </div>
         
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm">
          <span className="font-medium">{displayName}</span>
          {displayEmail ? <span className="text-gray-500 ml-2">&lt;{displayEmail}&gt;</span> : null}
          {isMine ? <span className="ml-2 text-xs text-gray-400">(you)</span> : null}
        </div>
              <span className="text-xs font-medium text-gray-900">id:{authorId}</span>
              {isInternal && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 text-xs">
                  <Lock className="h-3 w-3" />
                  Internal
                </span>
              )}
              <span className="text-xs text-gray-400">
                {new Date(createdAt).toLocaleString()}
              </span>
            </div>
            
            {/* Body */}
            <p className="mt-2 text-medium text-gray-700 whitespace-pre-wrap break-words bg-orange-50 p-2 rounded">
              {comment.body}
            </p>
          </div>
        </div>
        
        {/* Delete button */}
        {isOwn && (
          <button
            onClick={handleDelete}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 rounded"
            title="Delete comment"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

// ======