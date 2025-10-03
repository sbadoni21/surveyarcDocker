// ============================================================
// FILE: components/tickets/agent/TicketDetailPanel.jsx
// ============================================================
"use client";
import { useState, useEffect, useCallback } from "react";
import TicketModel from "@/models/ticketModel";
import CommentModel from "@/models/postGresModels/commentModel";
import WorklogModel from "@/models/postGresModels/worklogModel";
import TicketHeader from "./TicketHeader";
import TicketMetadata from "./TicketMetadata";
import ConversationSection from "./ConversationSection";
import WorklogsSection from "./WorklogsSection";
import SidebarActionsPanel from "./SidebarActionsPanel";

export default function TicketDetailPanel({ ticket, onTicketChanged, currentUserId }) {
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(ticket);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [worklogs, setWorklogs] = useState([]);

  const loadComments = useCallback(async () => {
    if (!ticket.ticketId) return;
    setCommentsLoading(true);
    try {
      const data = await CommentModel.list(ticket.ticketId);
      setComments(data || []);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [ticket.ticketId]);

  const hydrate = useCallback(async () => {
    try {
      // Get full ticket with SLA data included
      const t = await TicketModel.get(ticket.ticketId);
      setFull(t);
      await loadComments();
      
      const wls = await WorklogModel.list(ticket.ticketId).catch(() => []);
      setWorklogs(wls || []);
    } catch (err) {
      console.error("Hydrate error:", err);
    }
  }, [ticket.ticketId, loadComments]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleCommentAdded = async (newComment) => {
    setComments((prev) => [...prev, newComment]);
    // Refresh full ticket to get updated SLA timers
    const fresh = await TicketModel.get(full.ticketId);
    setFull(fresh);
    onTicketChanged?.(fresh);
  };

  const handleCommentDeleted = (commentId) => {
    setComments((prev) => prev.filter((c) => (c.comment_id || c.commentId) !== commentId));
  };

  const handleWorklogAdded = (worklog) => {
    setWorklogs((prev) => [worklog, ...prev]);
  };

  const handleTicketUpdated = async (updated) => {
    setFull(updated);
    onTicketChanged?.(updated);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TicketHeader ticket={full} />
      <TicketMetadata ticket={full} />

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12">
        {/* Main Content */}
        <div className="xl:col-span-8 border-r min-h-0 flex flex-col">
          <ConversationSection
            ticket={full}
            comments={comments}
            commentsLoading={commentsLoading}
            currentUserId={currentUserId}
            onCommentAdded={handleCommentAdded}
            onCommentDeleted={handleCommentDeleted}
            busy={busy}
            setBusy={setBusy}
          />
          <WorklogsSection
            ticket={full}
            worklogs={worklogs}
            currentUserId={currentUserId}
            onWorklogAdded={handleWorklogAdded}
            busy={busy}
            setBusy={setBusy}
          />
        </div>

        {/* Sidebar */}
        <div className="xl:col-span-4 min-h-0 flex flex-col">
          <SidebarActionsPanel
            ticket={full}
            onTicketUpdated={handleTicketUpdated}
            busy={busy}
            setBusy={setBusy}
          />
        </div>
      </div>
    </div>
  );
}