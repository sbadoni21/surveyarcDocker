
// ============================================================
// FILE: components/tickets/agent/CommentComposer.jsx
// ============================================================
"use client";
import { useState } from "react";
import { MessageSquare, Lock, Send, Paperclip, Loader2 } from "lucide-react";
import CommentModel from "@/models/postGresModels/commentModel";

export default function CommentComposer({ 
  ticket, 
  currentUserId, 
  onCommentAdded,
  busy,
  setBusy 
}) {
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const newComment = await CommentModel.create({
        ticketId: ticket.ticketId,
        authorId: currentUserId,
        body: reply.trim(),
        isInternal: isInternal,
      });
      
      setReply("");
      onCommentAdded?.(newComment);
    } catch (err) {
      console.error("Failed to send reply:", err);
      alert("Failed to send comment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 border-b space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MessageSquare className="h-4 w-4" />
          Add a reply
        </div>
        <label className="text-sm inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
          />
          <Lock className="h-3 w-3" />
          Internal note
        </label>
      </div>
      <textarea
        rows={3}
        className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder={isInternal ? "Write an internal note…" : "Write a public reply…"}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        disabled={busy}
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 inline-flex items-center gap-1">
          <Paperclip className="h-3 w-3" /> Attachments (not implemented)
        </div>
        <button
          onClick={handleSend}
          disabled={busy || !reply.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

