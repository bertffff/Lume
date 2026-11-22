import { earnedAchievementKeys, partyAchievements, type AchievementProgress } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import { notifyUser } from "./notify.js";

export async function seedPartyAchievements(prisma: PrismaClient): Promise<void> {
  for (const item of partyAchievements) {
    await prisma.achievement.upsert({
      where: { key: item.key },
      update: {
        titleRu: item.titleRu,
        titleEn: item.titleEn,
        descriptionRu: item.descriptionRu,
        descriptionEn: item.descriptionEn,
        icon: item.icon,
        xpReward: item.xpReward,
        points: item.xpReward,
        condition: item.condition,
      },
      create: {
        key: item.key,
        titleRu: item.titleRu,
        titleEn: item.titleEn,
        descriptionRu: item.descriptionRu,
        descriptionEn: item.descriptionEn,
        icon: item.icon,
        xpReward: item.xpReward,
        points: item.xpReward,
        condition: item.condition,
      },
    });
  }
}

export async function trackStat(
  prisma: PrismaClient,
  userId: string,
  field: "roomsCreated" | "totalParties" | "totalMessages" | "totalReactions" | "totalWatchTime",
  amount: number,
  telegramToken?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await prisma.user.update({ where: { id: userId }, data: { [field]: { increment: amount } } });
  await awardNew(prisma, userId, hourOf(user.timezone), telegramToken);
}

function hourOf(timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  } catch {
    return new Date().getUTCHours();
  }
}

export async function awardNew(
  prisma: PrismaClient,
  userId: string,
  hourInZone: number,
  telegramToken?: string,
): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return [];
  }
  const progress: AchievementProgress = {
    totalParties: user.totalParties,
    totalWatchTime: user.totalWatchTime,
    totalMessages: user.totalMessages,
    roomsCreated: user.roomsCreated,
    totalReactions: user.totalReactions,
    hourInZone,
  };
  const keys = earnedAchievementKeys(progress);
  const owned = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });
  const have = new Set(owned.map((row) => row.achievement.key));
  const fresh = keys.filter((key) => !have.has(key));
  for (const key of fresh) {
    const def = partyAchievements.find((item) => item.key === key);
    if (!def) {
      continue;
    }
    const achievement = await prisma.achievement.findUnique({ where: { key } });
    if (!achievement) {
      continue;
    }
    // Concurrent room/message actions can award the same achievement at once.
    // `skipDuplicates` makes the insert atomic; only the winner grants XP and
    // sends the notification, so parallel requests never fail with P2002.
    const inserted = await prisma.userAchievement.createMany({
      data: [{ userId, achievementId: achievement.id }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) {
      continue;
    }
    await prisma.user.update({ where: { id: userId }, data: { xp: { increment: def.xpReward } } });
    await notifyUser(prisma, {
      userId,
      kind: "ACHIEVEMENT_UNLOCKED",
      title: def.titleRu,
      body: def.descriptionRu,
      ...(telegramToken ? { telegramToken } : {}),
    });
  }
  return fresh;
}
