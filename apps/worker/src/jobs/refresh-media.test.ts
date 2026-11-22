import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@lume/db";
import { refreshDueStreamUrls } from "./refresh-media.js";

function fakePrisma(rows: Array<{ id: string; url: string }>) {
  const updates: Array<{ id: string; url: string; expiresAt: Date | null }> = [];
  const prisma = {
    queueItem: {
      findMany: async () => rows,
      update: async (args: { where: { id: string }; data: { url: string; expiresAt: Date | null } }) => {
        updates.push({ id: args.where.id, ...args.data });
        return args.data;
      },
    },
  } as unknown as PrismaClient;
  return { prisma, updates };
}

describe("proactive stream URL refresh (F041)", () => {
  it("writes the re-extracted URL and its expiry", async () => {
    const { prisma, updates } = fakePrisma([{ id: "q1", url: "https://old.example/a.m3u8" }]);
    const stats = await refreshDueStreamUrls(prisma, async () => ({
      playback: { url: "https://new.example/b.m3u8?expire=1999999999" },
    }));
    expect(stats).toEqual({ checked: 1, refreshed: 1, failed: 0 });
    expect(updates[0]?.url).toContain("new.example");
    expect(updates[0]?.expiresAt?.getTime()).toBe(1_999_999_999_000);
  });

  it("counts a failure and leaves the old URL untouched", async () => {
    const { prisma, updates } = fakePrisma([{ id: "q1", url: "https://old.example/a.m3u8" }]);
    const stats = await refreshDueStreamUrls(prisma, async () => null);
    expect(stats).toEqual({ checked: 1, refreshed: 0, failed: 1 });
    expect(updates).toEqual([]);
  });

  it("does nothing when no row is due", async () => {
    const { prisma } = fakePrisma([]);
    expect(await refreshDueStreamUrls(prisma, async () => null)).toEqual({
      checked: 0,
      refreshed: 0,
      failed: 0,
    });
  });
});
