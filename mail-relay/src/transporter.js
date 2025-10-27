import nodemailer from "nodemailer";
import 'dotenv/config'

export function makeTransporter(env = process.env) {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE || "false") === "true",
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
}
