import { Globe, Mail, Server, Settings, Shield } from "lucide-react";

export const providers = [
  {
    id: "sendgrid",
    label: "SendGrid",
    description: "Reliable transactional and marketing emails with excellent deliverability.",
    icon: Mail,
    popularity: "Most Popular",
    fields: [
      { name: "fromName", label: "From Name", type: "text", placeholder: "Your Company Name", required: true },
      { name: "fromEmail", label: "From Email", type: "email", placeholder: "noreply@yourcompany.com", required: true },
      { name: "apiKey", label: "SendGrid API Key", type: "password", placeholder: "SG.xxxxxxxx", required: true, sensitive: true },
    ],
  },
  {
    id: "mailgun",
    label: "Mailgun",
    description: "Powerful email delivery with advanced analytics and domain management.",
    icon: Server,
    fields: [
      { name: "fromName", label: "From Name", type: "text", placeholder: "Your Company Name", required: true },
      { name: "fromEmail", label: "From Email", type: "email", placeholder: "noreply@yourcompany.com", required: true },
      { name: "apiKey", label: "Mailgun API Key", type: "password", placeholder: "key-xxxxxxxx", required: true, sensitive: true },
      { name: "domain", label: "Mailgun Domain", type: "text", placeholder: "mg.yourcompany.com", required: true },
    ],
  },
  {
    id: "smtp",
    label: "SMTP",
    description: "Use your existing SMTP server with full control over configuration.",
    icon: Settings,
    fields: [
      { name: "fromName", label: "From Name", type: "text", placeholder: "Your Company Name", required: true },
      { name: "fromEmail", label: "From Email", type: "email", placeholder: "noreply@yourcompany.com", required: true },
      { name: "smtpHost", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com", required: true },
      { name: "smtpPort", label: "SMTP Port", type: "number", placeholder: "587", required: true },
      { name: "smtpUser", label: "SMTP Username", type: "text", placeholder: "username@gmail.com", required: true },
      { name: "smtpPass", label: "SMTP Password", type: "password", placeholder: "••••••••", required: true, sensitive: true },
    ],
  },
  {
    id: "postmark",
    label: "Postmark",
    description: "Fast, reliable transactional email with detailed analytics.",
    icon: Globe,
    fields: [
      { name: "fromName", label: "From Name", type: "text", placeholder: "Your Company Name", required: true },
      { name: "fromEmail", label: "From Email", type: "email", placeholder: "noreply@yourcompany.com", required: true },
      { name: "apiKey", label: "Postmark Server Token", type: "password", placeholder: "xxxxxxxx-xxxx-xxxx", required: true, sensitive: true },
    ],
  },
  {
    id: "ses",
    label: "Amazon SES",
    description: "Enterprise-grade email service with high deliverability and cost efficiency.",
    icon: Shield,
    fields: [
      { name: "fromName", label: "From Name", type: "text", placeholder: "Your Company Name", required: true },
      { name: "fromEmail", label: "From Email", type: "email", placeholder: "noreply@yourcompany.com", required: true },
      { name: "accessKeyId", label: "AWS Access Key ID", type: "text", placeholder: "AKIA...", required: true },
      { name: "secretAccessKey", label: "AWS Secret Access Key", type: "password", placeholder: "••••••••", required: true, sensitive: true },
      { name: "region", label: "AWS Region", type: "text", placeholder: "us-east-1", required: true },
    ],
  },
];