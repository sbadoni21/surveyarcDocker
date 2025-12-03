// components/tickets/agent/TicketDetailPanel.jsx
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
import SLAInfoCard from "./SLAInfoCard";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import AgentFollowupPanel from "./AgentFollowupPanel";

export default function TicketDetailPanel({ ticket, onTicketChanged, currentUserId }) {
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(ticket);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [worklogs, setWorklogs] = useState([]);
  const [authorMap, setAuthorMap] = useState({}); // NEW: userId -> user

  const { getUsersByIds } = useUser();

  const loadComments = useCallback(async () => {
    if (!ticket.ticketId) return;
    setCommentsLoading(true);
    try {
      const data = await CommentModel.list(ticket.ticketId);
      setComments(data || []);

      const ids = Array.from(
        new Set(
          (data || [])
            .map(c => c.author_id || c.authorId)
            .filter(Boolean)
        )
      );
      if (ids.length) {
        const users = await getUsersByIds(ids);
        const map = {};
        for (const u of users) {
          // adjust field names per your UserModel
          map[u.uid || u.user_id || u.id] = u;
        }
        setAuthorMap(map);
      } else {
        setAuthorMap({});
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [ticket.ticketId, getUsersByIds]);

  const hydrate = useCallback(async () => {
    try {
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

    // hydrate author for the new comment if missing
    const id = newComment.author_id || newComment.authorId;
    if (id && !authorMap[id]) {
      try {
        const [u] = await getUsersByIds([id]);
        if (u) {
          setAuthorMap((m) => ({ ...m, [u.uid || u.user_id || u.id]: u }));
        }
      } catch (e) {
        // ignore
      }
    }

    const fresh = await TicketModel.get(full.ticketId);
    setFull(fresh);
    onTicketChanged?.(fresh);
  };

  const handleSLAPaused = async () => {
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
  
<AgentFollowupPanel ticket={full} onTicketUpdated={handleTicketUpdated} />
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12">
        <div className="xl:col-span-8 border-r min-h-0 flex flex-col">
          <ConversationSection
            ticket={full}
            comments={comments}
            commentsLoading={commentsLoading}
            currentUserId={currentUserId}
            onCommentAdded={handleCommentAdded}
            onCommentDeleted={handleCommentDeleted}
            onSLAPaused={handleSLAPaused}
            authorMap={authorMap}               
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

        <div className="xl:col-span-4 min-h-0 flex flex-col">
          <SidebarActionsPanel
            ticket={full}
            onTicketUpdated={handleTicketUpdated}
            busy={busy}
            setBusy={setBusy}
          />
          <SLAInfoCard slaId={full.slaId} ticket={full} dimension="resolution" />
        </div>
      </div>
    </div>
  );
}
