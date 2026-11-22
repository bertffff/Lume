import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@lume/db";
import { createDigestRunner } from "./digest.js";

interface QueueRow {
  id: string;
  userId: string;
  notificationId: string;
  channel: string;
  kind: string;
  status: string;
  scheduledFor: Date;
  lastError: string | null;
}

interface State {
  rows: QueueRow[];
  preference?: { digest: string; quietHoursEnabled: boolean; quietStart: string; quietEnd: string; timezone: string } | null;
  channelPrefs?: Array<{ kind: string; enabled: boolean }>;
  notes?: Array<{ id: string; title: string; body: string; kind: string }>;
  user?: { email: string | null; telegramId?: bigint | null } | null;
  subscriptions?: Array<{ endpoint: string; keys: unknown }>;
}

function fakePrisma(state: State): PrismaClient {
  return {
    notificationDeliveryQueue: {
      findMany: async () => state.rows.filter((row) => row.status === "pending"),
      updateMany: async (args: { where: { id: { in: string[] } }; data: Partial<QueueRow> }) => {
        let count = 0;
        for (const row of state.rows) {
          if (!args.where.id.in.includes(row.id)) continue;
          Object.assign(row, args.data);
          count += 1;
        }
        return { count };
      },
    },
    notificationDeliveryPreference: { findUnique: async () => state.preference ?? null },
    notificationPreference: { findMany: async () => state.channelPrefs ?? [] },
    notification: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        (state.notes ?? []).filter((note) => args.where.id.in.includes(note.id)),
    },
    user: { findUnique: async () => state.user ?? null },
    pushSubscription: { findMany: async () => state.subscriptions ?? [] },
  } as unknown as PrismaClient;
}

function baseState(overrides: Partial<State> = {}): State {
  return {
    rows: [
      {
        id: "q1",
        userId: "u1",
        notificationId: "n1",
        channel: "email",
        kind: "ROOM_INVITE",
        status: "pending",
        scheduledFor: new Date("2026-11-21T10:00:00Z"),
        lastError: null,
      },
    ],
    notes: [{ id: "n1", title: "Приглашение", body: "Зал", kind: "ROOM_INVITE" }],
    user: { email: "u1@example.com" },
    ...overrides,
  };
}

describe("notify.digest", () => {
  it("marks email as skipped when SMTP is not configured", async () => {
    const state = baseState();
    const run = createDigestRunner(fakePrisma(state), {}, { log: () => undefined });
    const stats = await run(new Date("2026-11-21T10:01:00Z"));
    expect(stats).toMatchObject({ due: 1, sent: 0, skipped: 1, failed: 0 });
    expect(state.rows[0]).toMatchObject({ status: "skipped", lastError: "smtp_unconfigured" });
  });

  it("marks sent only after the provider accepts the message", async () => {
    const state = baseState();
    const sent: string[] = [];
    const run = createDigestRunner(
      fakePrisma(state),
      { SMTP_HOST: "smtp.example.com", SMTP_FROM: "lume@example.com" },
      {
        log: () => undefined,
        email: {
          configured: true,
          send: async (message) => {
            sent.push(message.to);
            return { status: "sent" };
          },
        },
      },
    );
    const stats = await run(new Date("2026-11-21T10:01:00Z"));
    expect(stats.sent).toBe(1);
    expect(sent).toEqual(["u1@example.com"]);
    expect(state.rows[0]).toMatchObject({ status: "sent", lastError: null });
  });

  it("does not claim delivery when the provider fails", async () => {
    const state = baseState();
    const run = createDigestRunner(
      fakePrisma(state),
      { SMTP_HOST: "smtp.example.com", SMTP_FROM: "lume@example.com" },
      {
        log: () => undefined,
        email: { configured: true, send: async () => ({ status: "failed", error: "smtp_550" }) },
      },
    );
    const stats = await run(new Date("2026-11-21T10:01:00Z"));
    expect(stats.failed).toBe(1);
    expect(state.rows[0]).toMatchObject({ status: "failed", lastError: "smtp_550" });
  });

  it("reschedules inside quiet hours instead of sending", async () => {
    const state = baseState({
      preference: {
        digest: "INSTANT",
        quietHoursEnabled: true,
        quietStart: "22:00",
        quietEnd: "08:00",
        timezone: "UTC",
      },
    });
    const run = createDigestRunner(fakePrisma(state), {}, { log: () => undefined });
    const stats = await run(new Date("2026-11-21T23:00:00Z"));
    expect(stats).toMatchObject({ rescheduled: 1, sent: 0, skipped: 0 });
    expect(state.rows[0]?.status).toBe("pending");
    expect(state.rows[0]?.scheduledFor.getTime()).toBeGreaterThan(new Date("2026-11-21T23:00:00Z").getTime());
  });

  it("fails a channel the user disabled", async () => {
    const state = baseState({ channelPrefs: [{ kind: "ROOM_INVITE", enabled: false }] });
    const run = createDigestRunner(fakePrisma(state), {}, { log: () => undefined });
    const stats = await run(new Date("2026-11-21T10:01:00Z"));
    expect(stats.failed).toBe(1);
    expect(state.rows[0]).toMatchObject({ status: "failed", lastError: "channel_disabled" });
  });

  it("reports push as skipped without VAPID keys", async () => {
    const state = baseState({
      rows: [
        {
          id: "q2",
          userId: "u1",
          notificationId: "n1",
          channel: "push",
          kind: "ROOM_INVITE",
          status: "pending",
          scheduledFor: new Date("2026-11-21T10:00:00Z"),
          lastError: null,
        },
      ],
      subscriptions: [{ endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } }],
    });
    const run = createDigestRunner(fakePrisma(state), {}, { log: () => undefined });
    const stats = await run(new Date("2026-11-21T10:01:00Z"));
    expect(stats.skipped).toBe(1);
    expect(state.rows[0]).toMatchObject({ status: "skipped", lastError: "vapid_unconfigured" });
  });
});
