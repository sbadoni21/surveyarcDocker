import express from "express";
import { makeTransporter } from "./transporter.js";
import tmplAssigned from "./templates/slaAssigned.js";
import tmplWarn from "./templates/slaWarn.js";
import tmplBreach from "./templates/slaBreach.js";
import tmplTicketComment from "./templates/ticketComment.js";
import tmplCalendarCreated from "./templates/calendarCreated.js";
import tmplCalendarDeleted from "./templates/calendarDeleted.js";
import tmplCampaignEmail from "./templates/campaignEmail.js";

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

    let to = [];
    let subject = "[Notification]";
    let html = "<pre>" + JSON.stringify(payload, null, 2) + "</pre>";

    // ==================== TICKET SYSTEM ====================
    if (kind === "sla.assigned") {
      to = _flatten(payload.recipients);
      subject = `[SLA Assigned] Ticket ${payload.ticket_id}`;
      html = tmplAssigned(payload);
    } 
    else if (kind === "sla.warn") {
      to = _flatten(payload.recipients);
      subject = `[SLA Warning] ${payload.dimension} at ${Math.round((payload.fraction||0)*100)}% — Ticket ${payload.ticket_id}`;
      html = tmplWarn(payload);
    } 
    else if (kind === "sla.breach") {
      to = _flatten(payload.recipients);
      subject = `[SLA Breach] ${payload.dimension} — Ticket ${payload.ticket_id}`;
      html = tmplBreach(payload);
    }   
    else if (kind === "ticket.comment") {
      to = _flatten(payload.recipients);
      const internalTag = payload.is_internal ? " [INTERNAL]" : "";  
      subject = `[TKT-${payload.number ?? "?"}] New comment${internalTag}: ${payload.subject ?? ""}`;
      html = tmplTicketComment(payload);
    }

    // ==================== CALENDAR SYSTEM ====================
    else if (kind === "calendar.created") {
      to = _flatten(payload.recipients);
      subject = `[Calendar] New business calendar: ${payload.name ?? payload.calendar_id}`;
      html = tmplCalendarCreated(payload);
    } 
    else if (kind === "calendar.deleted") {
      to = _flatten(payload.recipients);
      subject = `[Calendar] Business calendar deleted: ${payload.name ?? payload.calendar_id}`;
      html = tmplCalendarDeleted(payload);
    }

    // ==================== CAMPAIGN SYSTEM ====================
// In your mailer router.js

else if (kind === "campaign.email") {
  // Campaign emails have formatted HTML from the campaign
  to = payload.to || [];
  subject = payload.subject || "[Survey]";
  
  // ✅ Pass the payload to the template to handle HTML and tracking
  html = tmplCampaignEmail(payload);
  
  if (!to.length) {
    return res.status(400).json({ error: "Invalid campaign.email payload" });
  }
}
    else if (kind === "campaign.sms") {
      // SMS - forward to SMS provider (Twilio, etc.)
      console.log("SMS ▶", {
        to: payload.to,
        message: payload.message,
        tracking_token: payload.tracking_token
      });
      
      // TODO: Integrate with actual SMS provider
      // const twilioResponse = await sendSMS(payload);
      
      return res.json({ 
        ok: true, 
        provider: "sms",
        tracking_token: payload.tracking_token 
      });
    }
    else if (kind === "campaign.whatsapp") {
      // WhatsApp - forward to WhatsApp provider
      console.log("WhatsApp ▶", {
        to: payload.to,
        message: payload.message,
        template_id: payload.template_id,
        tracking_token: payload.tracking_token
      });
      
      // TODO: Integrate with actual WhatsApp provider (Twilio, MessageBird, etc.)
      // const whatsappResponse = await sendWhatsApp(payload);
      
      return res.json({ 
        ok: true, 
        provider: "whatsapp",
        tracking_token: payload.tracking_token 
      });
    }
    else if (kind === "campaign.voice") {
      // Voice - forward to voice provider
      console.log("Voice ▶", {
        to: payload.to,
        script: payload.script,
        tracking_token: payload.tracking_token
      });
      
      // TODO: Integrate with actual voice provider (Twilio Voice, etc.)
      // const voiceResponse = await makeVoiceCall(payload);
      
      return res.json({ 
        ok: true, 
        provider: "voice",
        tracking_token: payload.tracking_token 
      });
    }
    else {
      return res.status(400).json({ error: `Unknown kind: ${kind}` });
    }

    // Send email for non-campaign kinds or campaign.email
    if (!to.length) {
      return res.status(400).json({ error: "no recipients" });
    }

    const info = await transporter.sendMail({
      from: payload.from_name 
        ? `${payload.from_name} <${process.env.FROM_DEFAULT || process.env.SMTP_USER}>`
        : process.env.FROM_DEFAULT || process.env.SMTP_USER,
      to: to.join(","),
      replyTo: payload.reply_to || undefined,
      subject,
      html
    });
    
    console.log("MAIL KIND ▶", kind, { 
      to: to.length, 
      tracking_token: payload.tracking_token 
    });

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