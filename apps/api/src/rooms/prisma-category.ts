import type { PrismaClient } from "@lume/db";

/** Selection changes and current-item changes serialize on the same room row. */
export async function lockCategoryRoom(tx: Pick<PrismaClient, "$queryRaw">, roomId: string) {
  await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${roomId} FOR UPDATE`;
}
