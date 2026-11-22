import { createPrismaClient } from "@lume/db";

export const accountPurgeQueue = "account.purge";

/** Daily at 03:00 UTC. BullMQ repeat pattern. */
export const purgeRepeat = { pattern: "0 3 * * *" };

export async function purgeDueAccounts(now = new Date()): Promise<number> {
  if (!process.env.DATABASE_URL) {
    return 0;
  }
  const prisma = createPrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: { not: null }, scheduledDeletionAt: { lte: now } },
      select: { id: true },
    });
    for (const user of users) {
      await prisma.user.delete({ where: { id: user.id } });
    }
    return users.length;
  } finally {
    await prisma.$disconnect();
  }
}
