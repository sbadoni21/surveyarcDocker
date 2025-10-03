// ============================================================
// FILE: components/tickets/agent/CommentsList.jsx
// ============================================================
"use client";
import { Loader2, MessageSquare } from "lucide-react";
import CommentItem from "./CommentItem";

export default function CommentsList({ 
  comments, 
  loading, 
  currentUserId,
  onCommentDeleted 
}) {
  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6 text-gray-500 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-6 text-gray-500 flex flex-col items-center justify-center gap-2">
        <MessageSquare className="h-8 w-8 text-gray-300" />
        <p className="text-sm">No messages yet. Be the first to comment!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <ul className="divide-y">
        {comments.map((comment) => (
          <CommentItem
            key={comment.comment_id || comment.commentId}
            comment={comment}
            currentUserId={currentUserId}
            onDelete={onCommentDeleted}
          />
        ))}
      </ul>
    </div>
  );
}

