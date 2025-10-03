const BASE = "/api/post-gres-apis/tickets";

const json = async (res) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  }
  return res.json();
};

const CommentModel = {
  /** List comments for a ticket */
  async list(ticketId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/comments`, {
      cache: "no-store",
    });
    return json(res); // [{ comment_id, ticket_id, author_id, body, is_internal, created_at, updated_at }]
  },

  /** Create a comment.
   * Accepts either:
   *   { ticketId, authorId, body, isInternal }
   * or { uid, comment, isInternal } and we map it here for convenience.
   */
  async create(input) {
    const { ticketId } = input;
    if (!ticketId) throw new Error("ticketId is required");

    const payload = input.authorId || input.body
      ? {
          ticket_id: ticketId,
          author_id: input.authorId,
          body: input.body,
          is_internal: !!input.isInternal,
          comment_id: input.commentId,
        }
      : {
          // legacy shape
          uid: input.uid,
          comment: input.comment,
          is_internal: !!input.isInternal,
        };

    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return json(res);
  },

  /** Delete a comment */
  async remove(ticketId, commentId) {
    const res = await fetch(`${BASE}/${encodeURIComponent(ticketId)}/comments/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      // our proxy returns 200 with { ok: true }
      try { return await res.json(); } catch { return { ok: true }; }
    }
    const msg = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${msg}`);
  },
};

export default CommentModel;
