import express from "express";
import { makeTransporter } from "./transporter.js";
import tmplAssigned from "./templates/slaAssigned.js";
import tmplWarn from "./templates/slaWarn.js";
import tmplBreach from "./templates/slaBreach.js";
import tmplTicketComment from "./templates/ticketComment.js";
import tmplCalendarCreated from "./templates/calendarCreated.js";
import tmplCalendarDeleted from "./templates/calendarDeleted.js";
export const router = express.Router();
const transporter = makeTransporter();

function verifyAuth(req, res, next) {
  const token = process.env.MAIL_API_TOKEN;
  if (!token) return next();
  const header = req.get("Authorization") || "";
  if (header !== `Bearer ${token}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

router.post("/send", verifyAuth, async (req, res) => {
  try {
    const { to = [], cc = [], bcc = [], subject, html, attachments = [], from } = req.body || {};
    if (!subject || !html || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: "to[], subject, html required" });
    }
    const info = await transporter.sendMail({
      from: from || process.env.FROM_DEFAULT || process.env.SMTP_USER,
      to: to.join(","),
      cc: cc.length ? cc.join(",") : undefined,
      bcc: bcc.length ? bcc.join(",") : undefined,
      subject, html, attachments
    });
    console.log("MAIL ▶", { to, cc, bcc, subject, len: (html||"").length, fromAddr: from });

    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/send/from-payload", verifyAuth, async (req, res) => {
  try {
    const { kind, payload = {} } = req.body || {};
    if (!kind) return res.status(400).json({ error: "kind required" });

    const to = _flatten(payload.recipients);
    if (!to.length) return res.status(400).json({ error: "no recipients" });

    let subject = "[Notification]";
    let html = "<pre>" + JSON.stringify(payload, null, 2) + "</pre>";

    if (kind === "sla.assigned") {
      subject = `[SLA Assigned] Ticket ${payload.ticket_id}`;
      html = tmplAssigned(payload);
    } else if (kind === "sla.warn") {
      subject = `[SLA Warning] ${payload.dimension} at ${Math.round((payload.fraction||0)*100)}% — Ticket ${payload.ticket_id}`;
      html = tmplWarn(payload);
    } else if (kind === "sla.breach") {
      subject = `[SLA Breach] ${payload.dimension} — Ticket ${payload.ticket_id}`;
      html = tmplBreach(payload);
    }   else if (kind === "ticket.comment") {
      const internalTag = payload.is_internal ? " [INTERNAL]" : "";  
      subject = `[TKT-${payload.number ?? "?"}] New comment${internalTag}: ${payload.subject ?? ""}`;
      html = tmplTicketComment(payload);
    }
      else if (kind === "calendar.created") {
      subject = `[Calendar] New business calendar: ${payload.name ?? payload.calendar_id}`;
      html = tmplCalendarCreated(payload);
    } else if (kind === "calendar.deleted") {
      subject = `[Calendar] Business calendar deleted: ${payload.name ?? payload.calendar_id}`;
      html = tmplCalendarDeleted(payload);
    }
    

    const info = await transporter.sendMail({
      from: process.env.FROM_DEFAULT || process.env.SMTP_USER,
      to: to.join(","),
      subject,
      html
    });
    console.log("MAIL KIND ▶", kind, payload);

    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

function _flatten(map = {}) {
  const out = new Set();
  Object.values(map || {}).forEach(arr => (arr || []).forEach(v => v && out.add(v)));
  return Array.from(out);
}
