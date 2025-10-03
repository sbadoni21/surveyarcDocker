"use client";
import CommentComposer from "./CommentComposer";
import CommentsList from "./CommentsList";

export default function ConversationSection({
  ticket,
  comments,
  commentsLoading,
  currentUserId,
  onCommentAdded,
  onCommentDeleted,
  busy,
  setBusy,
}) {
  return (
    <>
      <CommentComposer
        ticket={ticket}
        currentUserId={currentUserId}
        onCommentAdded={onCommentAdded}
        busy={busy}
        setBusy={setBusy}
      />
      <CommentsList
        comments={comments}
        loading={commentsLoading}
        currentUserId={currentUserId}
        onCommentDeleted={onCommentDeleted}
      />
    </>
  );
}