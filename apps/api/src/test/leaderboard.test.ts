import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "@lume/db";
import { buildApp } from "../app.js";
import { loadApiEnv } from "../env.js";

const databaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";

interface BoardRow {
  userId: string;
  displayName: string;
  value: number;
}

describe("leaderboards", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("ranks messages, reactions, and voice from persisted rows", async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = createPrismaClient();
    const env = loadApiEnv({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: "leaderboard-test-secret",
      ALLOW_STUB_AUTH: "true",
      WEB_ORIGIN: "http://127.0.0.1:5173",
    });
    app = await buildApp(env, { prisma });
    const stamp = Date.now().toString(36);
    const logins = await Promise.all(
      ["A", "B", "C"].map((suffix) =>
        app!.inject({ method: "POST", url: "/auth/dev", payload: { displayName: `Board ${suffix} ${stamp}` } }),
      ),
    );
    const accounts = logins.map((login) => login.json() as { accessToken: string; user: { id: string; displayName: string } });
    const [alice, bob, carol] = accounts;

    const created = await app.inject({
      method: "POST",
      url: "/rooms",
      headers: { authorization: `Bearer ${alice!.accessToken}` },
      payload: { title: `Board room ${stamp}` },
    });
    const room = created.json() as { room: { id: string; code: string } };
    for (const account of [bob!, carol!]) {
      const joined = await app.inject({
        method: "POST",
        url: "/rooms/join",
        headers: { authorization: `Bearer ${account.accessToken}` },
        payload: { code: room.room.code },
      });
      expect(joined.statusCode).toBe(200);
    }

    const messageIds: string[] = [];
    for (const account of [alice!, alice!, alice!, bob!]) {
      const sent = await app.inject({
        method: "POST",
        url: `/rooms/${room.room.id}/messages`,
        headers: { authorization: `Bearer ${account.accessToken}` },
        payload: { body: `leaderboard ${stamp}` },
      });
      expect(sent.statusCode).toBe(200);
      messageIds.push(sent.json().id as string);
    }
    for (const [account, emoji] of [[alice!, "🔥"], [bob!, "🔥"], [bob!, "❤️"]] as const) {
      const reacted = await app.inject({
        method: "POST",
        url: `/rooms/${room.room.id}/reactions`,
        headers: { authorization: `Bearer ${account.accessToken}` },
        payload: { messageId: messageIds[0], emoji },
      });
      expect(reacted.statusCode).toBe(200);
    }
    for (const [account, seconds] of [[alice!, 120], [bob!, 30]] as const) {
      const voice = await app.inject({
        method: "POST",
        url: "/me/voice-seconds",
        headers: { authorization: `Bearer ${account.accessToken}` },
        payload: { seconds },
      });
      expect(voice.statusCode).toBe(200);
    }

    const response = await app.inject({ method: "GET", url: "/stats/leaderboard?limit=50" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { messages: BoardRow[]; reactions: BoardRow[]; voice: BoardRow[]; users: unknown[] };

    const messageCount = await prisma.message.count({ where: { userId: alice!.user.id } });
    const reactionCount = await prisma.reaction.count({ where: { userId: bob!.user.id } });
    const aliceMessages = body.messages.find((row) => row.userId === alice!.user.id);
    const bobMessages = body.messages.find((row) => row.userId === bob!.user.id);
    expect(aliceMessages?.value).toBe(messageCount);
    expect(bobMessages?.value).toBeGreaterThanOrEqual(1);
    expect(aliceMessages?.value).toBeGreaterThan(bobMessages?.value ?? 0);
    expect(aliceMessages?.displayName).toContain("Board A");

    const bobReactions = body.reactions.find((row) => row.userId === bob!.user.id);
    expect(bobReactions?.value).toBe(reactionCount);
    expect(bobReactions?.value).toBeGreaterThanOrEqual(2);

    expect(body.voice.find((row) => row.userId === alice!.user.id)?.value).toBe(120);
    expect(body.voice.find((row) => row.userId === bob!.user.id)?.value).toBe(30);
    expect(body.voice.find((row) => row.userId === carol!.user.id)).toBeUndefined();

    for (const board of [body.messages, body.reactions, body.voice]) {
      const values = board.map((row) => row.value);
      expect(values).toEqual([...values].sort((left, right) => right - left));
      expect(values.length).toBeLessThanOrEqual(50);
    }

    const limited = await app.inject({ method: "GET", url: "/stats/leaderboard?limit=1" });
    expect(limited.json().messages).toHaveLength(1);
    expect(limited.json().reactions).toHaveLength(1);
    expect(limited.json().voice).toHaveLength(1);

    await prisma.room.deleteMany({ where: { id: room.room.id } });
    await prisma.user.deleteMany({ where: { id: { in: accounts.map((account) => account.user.id) } } });
    await prisma.$disconnect();
  });
});
