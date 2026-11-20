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

/** Reports whether a channel can actually deliver; never claims a send. */
export function deliveryReadiness(env: {
  SMTP_HOST?: string | undefined;
  SMTP_USER?: string | undefined;
  SMTP_FROM?: string | undefined;
  VAPID_PUBLIC_KEY?: string | undefined;
  VAPID_PRIVATE_KEY?: string | undefined;
  VAPID_SUBJECT?: string | undefined;
}): {
  email: { channel: "email"; status: "configured" | "skipped"; reason?: string };
  push: { channel: "push"; status: "configured" | "skipped"; reason?: string };
} {
  const smtp = Boolean(env.SMTP_HOST && (env.SMTP_FROM ?? env.SMTP_USER));
  const vapid = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
  return {
    email: smtp ? { channel: "email", status: "configured" } : { channel: "email", status: "skipped", reason: "smtp_unconfigured" },
    push: vapid ? { channel: "push", status: "configured" } : { channel: "push", status: "skipped", reason: "vapid_unconfigured" },
  };
}
