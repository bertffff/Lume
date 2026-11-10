import { inQuietHours, nextDigestAt, type DigestMode } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";

export async function notifyUser(
  prisma: PrismaClient,
  input: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    telegramToken?: string;
  },
): Promise<void> {
  const note = await prisma.notification.create({
    data: { userId: input.userId, kind: input.kind, title: input.title, body: input.body },
  });
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.deletedAt) {
    return;
  }
  const delivery = await prisma.notificationDeliveryPreference.findUnique({ where: { userId: user.id } });
  const digest = (delivery?.digest ?? "INSTANT") as DigestMode;
  const quiet = inQuietHours({
    now: new Date(),
    start: delivery?.quietStart ?? "22:00",
    end: delivery?.quietEnd ?? "08:00",
    timeZone: delivery?.timezone ?? user.timezone,
    enabled: delivery?.quietHoursEnabled ?? false,
  });
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId_channel_kind: { userId: user.id, channel: "telegram", kind: input.kind } },
  });
  const telegramOn = preference ? preference.enabled : true;
  if (telegramOn && input.telegramToken && user.telegramId && digest === "INSTANT" && !quiet) {
    await sendTelegram(input.telegramToken, user.telegramId.toString(), `${input.title}\n${input.body}`);
    return;
  }
  if (digest !== "INSTANT" || quiet) {
    await prisma.notificationDeliveryQueue.create({
      data: {
        userId: user.id,
        notificationId: note.id,
        channel: "telegram",
        kind: input.kind,
        scheduledFor: nextDigestAt({ now: new Date(), digest, quiet }),
      },
    });
  }
}

export async function sendTelegram(token: string, chatId: string, text: string): Promise<"sent" | "failed"> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export function emailStub(smtpHost: string | undefined = process.env.SMTP_HOST): { channel: "email"; status: "sent" | "skipped" } {
  return { channel: "email", status: smtpHost ? "sent" : "skipped" };
}

export function pushStub(vapidKey: string | undefined = process.env.VAPID_PUBLIC_KEY): { channel: "push"; status: "sent" | "skipped" } {
  return { channel: "push", status: vapidKey ? "sent" : "skipped" };
}

export function captureSentry(dsn: string | undefined, message: string): { captured: boolean; message: string } {
  return { captured: Boolean(dsn), message };
}
