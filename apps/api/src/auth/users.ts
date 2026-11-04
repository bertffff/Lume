import type { TelegramWebAppUser, User } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import { localeFromTelegram } from "./telegram.js";

export function toPublicUser(user: {
  id: string;
  telegramId: bigint | null;
  username: string | null;
  displayName: string;
  locale: "ru" | "en";
  themeId: string;
}): User {
  return {
    id: user.id,
    telegramId: user.telegramId === null ? null : user.telegramId.toString(),
    username: user.username,
    displayName: user.displayName,
    locale: user.locale,
    themeId: user.themeId,
  };
}

export async function upsertDevUser(prisma: PrismaClient, displayName: string) {
  const trimmed = displayName.trim();
  const key = trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 32);
  const username = `dev:${key || "guest"}`;
  return prisma.user.upsert({
    where: { username },
    create: { username, displayName: trimmed, locale: "ru" },
    update: { displayName: trimmed },
  });
}

export async function upsertTelegramUser(prisma: PrismaClient, telegramUser: TelegramWebAppUser) {
  const telegramId = BigInt(telegramUser.id);
  const username = `tg:${telegramUser.id}`;
  const locale = localeFromTelegram(telegramUser.language_code);
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { displayName: telegramUser.first_name, locale },
    });
  }
  return prisma.user.create({
    data: {
      telegramId,
      username,
      displayName: telegramUser.first_name,
      locale,
    },
  });
}
