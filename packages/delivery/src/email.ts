import nodemailer, { type Transporter } from "nodemailer";
import type { DeliveryResult, EmailConfig, EmailMessage, EmailSender } from "./index.js";

export function createEmailSender(config: EmailConfig = {}): EmailSender {
  const from = config.from ?? config.user;
  const configured = Boolean(config.host && from);
  let transporter: Transporter | null = null;

  function transport(): Transporter | null {
    if (!configured) return null;
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port ?? 587,
        secure: (config.port ?? 587) === 465,
        ...(config.user && config.password
          ? { auth: { user: config.user, pass: config.password } }
          : {}),
      });
    }
    return transporter;
  }

  return {
    configured,
    async send(message: EmailMessage): Promise<DeliveryResult> {
      const client = transport();
      if (!client || !from) {
        return { status: "skipped", reason: "smtp_unconfigured" };
      }
      try {
        await client.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        });
        return { status: "sent" };
      } catch (error) {
        return { status: "failed", error: error instanceof Error ? error.message : "smtp_failed" };
      }
    },
  };
}
