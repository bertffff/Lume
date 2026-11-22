/**
 * Delivery outcome. `sent` is only returned after the provider accepted the
 * message. Missing credentials are `skipped`, provider errors are `failed`.
 */
export type DeliveryResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export interface EmailConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  from?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  readonly configured: boolean;
  send(message: EmailMessage): Promise<DeliveryResult>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushConfig {
  publicKey?: string;
  privateKey?: string;
  subject?: string;
}

export interface PushSender {
  readonly configured: boolean;
  send(subscription: PushSubscriptionInput, payload: string): Promise<DeliveryResult>;
}

export { createEmailSender } from "./email.js";
export { createPushSender, vapidConfigured } from "./push.js";
