import { buildDigest, inQuietHours, nextDigestAt, type DigestMode } from "@lume/contracts";
import { createEmailSender, createPushSender, type DeliveryResult, type EmailSender, type PushSender } from "@lume/delivery";
import type { PrismaClient } from "@lume/db";

export const digestQueue = "notify.digest";
export const digestRepeat = { pattern: "*/15 * * * *" };

export interface DigestEnv {
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: number | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
  SMTP_FROM?: string | undefined;
  VAPID_PUBLIC_KEY?: string | undefined;
  VAPID_PRIVATE_KEY?: string | undefined;
  VAPID_SUBJECT?: string | undefined;
  TELEGRAM_BOT_TOKEN?: string | undefined;
  WEB_ORIGIN?: string | undefined;
}

export interface DigestRunStats {
  due: number;
  sent: number;
  failed: number;
  skipped: number;
  rescheduled: number;
}

export interface DigestDeps {
  email?: EmailSender;
  push?: PushSender;
  fetchImpl?: typeof fetch;
  log?: (entry: Record<string, unknown>) => void;
}

interface QueuedRow {
  id: string;
  userId: string;
  notificationId: string;
  channel: string;
  kind: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegram(token: string, chatId: string, text: string, fetchImpl: typeof fetch): Promise<DeliveryResult> {
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { status: "failed", error: `telegram_${response.status}` };
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "telegram_failed" };
  }
}

export function createEmailSenderFromEnv(env: DigestEnv): EmailSender {
  return createEmailSender({
    ...(env.SMTP_HOST ? { host: env.SMTP_HOST } : {}),
    ...(env.SMTP_PORT ? { port: env.SMTP_PORT } : {}),
    ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
    ...(env.SMTP_PASSWORD ? { password: env.SMTP_PASSWORD } : {}),
    ...(env.SMTP_FROM ? { from: env.SMTP_FROM } : {}),
  });
}

export function createPushSenderFromEnv(env: DigestEnv): PushSender {
  return createPushSender({
    ...(env.VAPID_PUBLIC_KEY ? { publicKey: env.VAPID_PUBLIC_KEY } : {}),
    ...(env.VAPID_PRIVATE_KEY ? { privateKey: env.VAPID_PRIVATE_KEY } : {}),
    ...(env.VAPID_SUBJECT ? { subject: env.VAPID_SUBJECT } : {}),
  });
}

/**
 * Sends due digests for real. A row is `sent` only after the provider accepted
 * it; missing credentials produce `skipped`, provider errors `failed`.
 */
export function createDigestRunner(prisma: PrismaClient, env: DigestEnv, deps: DigestDeps = {}) {
  const email = deps.email ?? createEmailSenderFromEnv(env);
  const push = deps.push ?? createPushSenderFromEnv(env);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const log = deps.log ?? ((entry) => console.log(JSON.stringify({ queue: digestQueue, ...entry })));

  return async function runDigest(now = new Date()): Promise<DigestRunStats> {
    const stats: DigestRunStats = { due: 0, sent: 0, failed: 0, skipped: 0, rescheduled: 0 };
    const due = await prisma.notificationDeliveryQueue.findMany({
      where: { status: "pending", scheduledFor: { lte: now } },
      orderBy: { scheduledFor: "asc" },
      take: 100,
      select: { id: true, userId: true, notificationId: true, channel: true, kind: true },
    });
    stats.due = due.length;
    if (due.length === 0) return stats;

    const groups = new Map<string, QueuedRow[]>();
    for (const row of due) {
      const key = `${row.userId}:${row.channel}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    for (const rows of groups.values()) {
      const first = rows[0];
      if (!first) continue;
      const userId = first.userId;
      const channel = first.channel;
      const preference = await prisma.notificationDeliveryPreference.findUnique({ where: { userId } });
      const digestMode = (preference?.digest ?? "INSTANT") as DigestMode;
      const quiet = inQuietHours({
        now,
        start: preference?.quietStart ?? "22:00",
        end: preference?.quietEnd ?? "08:00",
        timeZone: preference?.timezone ?? "UTC",
        enabled: preference?.quietHoursEnabled ?? false,
      });
      if (quiet) {
        const scheduledFor = nextDigestAt({ now, digest: digestMode, quiet });
        await prisma.notificationDeliveryQueue.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: { scheduledFor },
        });
        stats.rescheduled += rows.length;
        continue;
      }

      const disabled = await prisma.notificationPreference.findMany({
        where: { userId, channel: channel as "web" | "telegram" | "email" | "push" },
        select: { kind: true, enabled: true },
      });
      const disabledKinds = new Set(disabled.filter((row) => !row.enabled).map((row) => row.kind));
      const enabledRows = rows.filter((row) => !disabledKinds.has(row.kind));
      const blockedRows = rows.filter((row) => disabledKinds.has(row.kind));
      if (blockedRows.length > 0) {
        await prisma.notificationDeliveryQueue.updateMany({
          where: { id: { in: blockedRows.map((row) => row.id) } },
          data: { status: "failed", lastError: "channel_disabled" },
        });
        stats.failed += blockedRows.length;
        log({ event: "channel_disabled", userId, channel, count: blockedRows.length });
      }
      if (enabledRows.length === 0) continue;

      const notifications = await prisma.notification.findMany({
        where: { id: { in: enabledRows.map((row) => row.notificationId) } },
        select: { id: true, title: true, body: true, kind: true },
      });
      const byId = new Map(notifications.map((note) => [note.id, note]));
      const items = enabledRows
        .map((row) => byId.get(row.notificationId))
        .filter((note): note is { id: string; title: string; body: string; kind: string } => Boolean(note));
      if (items.length === 0) {
        await prisma.notificationDeliveryQueue.updateMany({
          where: { id: { in: enabledRows.map((row) => row.id) } },
          data: { status: "failed", lastError: "notification_missing" },
        });
        stats.failed += enabledRows.length;
        continue;
      }

      const digest = buildDigest(items);
      let result: DeliveryResult;
      if (channel === "email") {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user?.email) {
          result = { status: "skipped", reason: "email_missing" };
        } else if (!email.configured) {
          result = { status: "skipped", reason: "smtp_unconfigured" };
        } else {
          result = await email.send({
            to: user.email,
            subject: digest.title,
            text: digest.body,
            html: `<p>${escapeHtml(digest.body).replace(/\n/g, "<br>")}</p>`,
          });
        }
      } else if (channel === "push") {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId },
          select: { endpoint: true, keys: true },
        });
        if (!push.configured) {
          result = { status: "skipped", reason: "vapid_unconfigured" };
        } else if (subscriptions.length === 0) {
          result = { status: "skipped", reason: "no_subscriptions" };
        } else {
          const payload = JSON.stringify({
            title: digest.title,
            body: digest.body,
            data: {
              digest: true,
              count: items.length,
              notificationIds: items.map((item) => item.id),
              channel,
            },
          });
          const outcomes = await Promise.all(
            subscriptions.map((subscription) => {
              const keys = (subscription.keys ?? {}) as { p256dh?: string; auth?: string };
              if (!keys.p256dh || !keys.auth) {
                return Promise.resolve<DeliveryResult>({ status: "failed", error: "invalid_subscription" });
              }
              return push.send(
                { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
                payload,
              );
            }),
          );
          const sent = outcomes.some((outcome) => outcome.status === "sent");
          const failed = outcomes.find((outcome) => outcome.status === "failed");
          result = sent ? { status: "sent" } : (failed ?? { status: "skipped", reason: "no_subscriptions" });
        }
      } else if (channel === "telegram") {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } });
        if (!env.TELEGRAM_BOT_TOKEN) {
          result = { status: "skipped", reason: "telegram_unconfigured" };
        } else if (!user?.telegramId) {
          result = { status: "skipped", reason: "telegram_unlinked" };
        } else {
          result = await sendTelegram(
            env.TELEGRAM_BOT_TOKEN,
            user.telegramId.toString(),
            `${digest.title}\n${digest.body}`,
            fetchImpl,
          );
        }
      } else {
        // In-app: the Notification row itself is the delivery.
        result = { status: "sent" };
      }

      const ids = enabledRows.map((row) => row.id);
      if (result.status === "sent") {
        await prisma.notificationDeliveryQueue.updateMany({
          where: { id: { in: ids } },
          data: { status: "sent", lastError: null },
        });
        stats.sent += ids.length;
      } else if (result.status === "skipped") {
        await prisma.notificationDeliveryQueue.updateMany({
          where: { id: { in: ids } },
          data: { status: "skipped", lastError: result.reason },
        });
        stats.skipped += ids.length;
        log({ event: "skipped", userId, channel, reason: result.reason, count: ids.length });
      } else {
        await prisma.notificationDeliveryQueue.updateMany({
          where: { id: { in: ids } },
          data: { status: "failed", lastError: result.error },
        });
        stats.failed += ids.length;
        log({ event: "failed", userId, channel, error: result.error, count: ids.length });
      }
    }
    return stats;
  };
}
