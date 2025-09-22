import { NextResponse } from 'next/server';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import nodemailer from 'nodemailer';
import mailgun from 'mailgun-js';
import sgMail from '@sendgrid/mail';
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { decrypt } from '@/utils/encryption';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { orgId, providerId, to, subject, text, html } = body;

    console.log("📥 Incoming request body:", body);

    // Input validation
    if (!orgId || !providerId || !to || !subject) {
      console.warn("❌ Missing required fields");
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!text && !html) {
      console.warn("❌ No text or HTML content provided");
      return NextResponse.json({ error: 'Either text or html content is required' }, { status: 400 });
    }

    if (!isValidEmail(to)) {
      console.warn("❌ Invalid email address:", to);
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Load org document
    console.log("🔍 Fetching organization:", orgId);
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    if (!orgSnap.exists()) {
      console.warn("❌ Organization not found");
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Find default email configuration
    const configs = orgSnap.data().emailConfigurations || [];
    const config = configs.find(c => c.provider === providerId && c.isDefault);
    if (!config) {
      console.warn("❌ No default configuration for provider:", providerId);
      return NextResponse.json({ error: 'Email configuration not found' }, { status: 404 });
    }

    console.log("🔐 Encrypted configuration found:", config);

    // Decrypt sensitive config
    const decryptedConfig = { ...config };
    Object.keys(config).forEach((key) => {
      if (
        key.toLowerCase().includes('apikey') ||
        key.toLowerCase().includes('pass') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('smtpPass')
      ) {
        try {
          decryptedConfig[key] = decrypt(config[key]);
          console.log(`🔓 Decrypted ${key}`);
        } catch (error) {
          console.error(`❌ Failed to decrypt ${key}:`, error);
          return NextResponse.json({ error: 'Configuration decryption failed' }, { status: 500 });
        }
      }
    });

    console.log("✅ Decrypted config ready (excluding sensitive data):", {
      provider: decryptedConfig.provider,
      fromEmail: decryptedConfig.fromEmail,
      fromName: decryptedConfig.fromName,
      smtpPass: decryptedConfig.smtpPass
    });

    // Switch based on provider
    let response;
    switch (providerId) {
      case 'sendgrid':
        console.log("🚀 Sending via SendGrid...");
        sgMail.setApiKey(decryptedConfig.apiKey);
        const sgMessage = {
          to,
          from: decryptedConfig.fromEmail,
          subject,
        };
        if (html) sgMessage.html = html;
        if (text) sgMessage.text = text;
        console.log("📤 SendGrid message:", sgMessage);
        response = await sgMail.send(sgMessage);
        break;

      case 'mailgun':
        console.log("🚀 Sending via Mailgun...");
        const mg = mailgun({
          apiKey: decryptedConfig.apiKey,
          domain: decryptedConfig.domain,
        });
        const mgMessage = {
          from: `${decryptedConfig.fromName} <${decryptedConfig.fromEmail}>`,
          to,
          subject,
        };
        if (html) mgMessage.html = html;
        if (text) mgMessage.text = text;
        console.log("📤 Mailgun message:", mgMessage);
        response = await mg.messages().send(mgMessage);
        break;

      case 'ses':
        console.log("🚀 Sending via AWS SES...");
        const sesClient = new SESClient({
          region: decryptedConfig.region,
          credentials: {
            accessKeyId: decryptedConfig.accessKeyId,
            secretAccessKey: decryptedConfig.secretAccessKey,
          },
        });
        const messageBody = {};
        if (text) messageBody.Text = { Data: text };
        if (html) messageBody.Html = { Data: html };
        const params = {
          Source: decryptedConfig.fromEmail,
          Destination: {
            ToAddresses: [to],
          },
          Message: {
            Subject: {
              Data: subject,
            },
            Body: messageBody,
          },
        };
        console.log("📤 SES email parameters:", params);
        const command = new SendEmailCommand(params);
        response = await sesClient.send(command);
        break;

      case 'smtp':
        console.log("🚀 Sending via SMTP...");
        const transporter = nodemailer.createTransport({
          host: decryptedConfig.smtpHost,
          port: decryptedConfig.smtpPort,
          secure: decryptedConfig.smtpPort === 465,
          auth: {
            user: decryptedConfig.smtpUser,
            pass: decryptedConfig.smtpPass,
          },
        });
        const mailOptions = {
          from: `${decryptedConfig.fromName} <${decryptedConfig.fromEmail}>`,
          to,
          subject,
        };
        if (html) mailOptions.html = html;
        if (text) mailOptions.text = text;
        console.log("📤 SMTP email options:", mailOptions);
        response = await transporter.sendMail(mailOptions);
        break;

      default:
        console.warn("❌ Unsupported email provider:", providerId);
        return NextResponse.json({ error: 'Unsupported email provider' }, { status: 400 });
    }

    console.log("✅ Email sent successfully via", providerId);
    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      provider: providerId,
    }, { status: 200 });

  } catch (err) {
    console.error('❌ Email sending error:', err);
    let errorMessage = 'Internal Server Error';
    if (err.message?.includes('authentication')) {
      errorMessage = 'Email provider authentication failed';
    } else if (err.message?.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded, please try again later';
    } else if (err.message?.includes('invalid')) {
      errorMessage = 'Invalid email configuration';
    }

    return NextResponse.json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    }, { status: 500 });
  }
}
