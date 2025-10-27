import { wrap } from "./base.js";

// very light sanitization for body
const esc = (s="") => String(s)
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/\n/g,"<br/>");

export default function tmplTicketComment({
  ticket_id,
  number,
  subject,
  author_id,
  is_internal,
  body,
  org_id,
}) {
  const badge = is_internal ? `<span style="color:#b45309;background:#fff7ed;border:1px solid #fdba74;border-radius:4px;padding:2px 6px;margin-left:6px;font-size:12px;">INTERNAL</span>` : "";
  return wrap(`
    <h2 style="margin:0 0 8px 0;">New comment on ticket <b>TKT-${number ?? "?"}</b> ${badge}</h2>
    <p style="margin:0 0 12px 0;"><b>Subject:</b> ${esc(subject ?? "")}</p>
    <ul style="margin:0 0 12px 18px;padding:0;">
      <li><b>Ticket ID:</b> ${esc(ticket_id ?? "")}</li>
      <li><b>Org:</b> ${esc(org_id ?? "")}</li>
      <li><b>Author:</b> ${esc(author_id ?? "-")}</li>
    </ul>
    <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />
    <div style="font-size:14px;line-height:1.5;white-space:normal;">${esc(body ?? "") || "<i>(no content)</i>"}</div>
  `);
}
