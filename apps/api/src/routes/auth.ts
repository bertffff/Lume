import {
  accessTokenRequestSchema,
  telegramAuthRequestSchema,
  type User,
} from "@lume/contracts";
import { devAuthRequestSchema } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import { unlinkAllowed } from "@lume/contracts";
import { z } from "zod";
import type { ApiEnv } from "../env.js";
import { mintAccessToken } from "../auth/jwt.js";
import { issueRefresh } from "../auth/refresh-store.js";
import { requireUser } from "../auth/guard.js";
import { localeFromTelegram, verifyLoginWidget, verifyTelegramInitData } from "../auth/telegram.js";
import { toPublicUser, upsertDevUser, upsertTelegramUser } from "../auth/users.js";

function publicUser(input: {
  id: string;
  telegramId: string | null;
  username: string | null;
  displayName: string;
  locale: "ru" | "en";
}): User {
  return {
    id: input.id,
    telegramId: input.telegramId,
    username: input.username,
    displayName: input.displayName,
    locale: input.locale,
    themeId: "ember",
  };
}

export function registerAuthRoutes(app: FastifyInstance, env: ApiEnv, prisma?: PrismaClient): void {
  app.post("/auth/telegram", async (request, reply) => {
    const body = telegramAuthRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }

    if (!env.TELEGRAM_BOT_TOKEN) {
      if (!env.ALLOW_STUB_AUTH) {
        return reply.code(501).send({ error: "telegram_unconfigured" });
      }
      const params = new URLSearchParams(body.data.initData);
      const userRaw = params.get("user");
      if (!userRaw) {
        return reply.code(400).send({ error: "invalid_body" });
      }
      let parsedUser: { id?: number; first_name?: string; username?: string; language_code?: string };
      try {
        parsedUser = JSON.parse(userRaw) as typeof parsedUser;
      } catch {
        return reply.code(400).send({ error: "invalid_body" });
      }
      if (!parsedUser.id || !parsedUser.first_name) {
        return reply.code(400).send({ error: "invalid_body" });
      }
      if (prisma) {
        const stored = await upsertTelegramUser(prisma, {
          id: parsedUser.id,
          first_name: parsedUser.first_name,
          ...(parsedUser.username ? { username: parsedUser.username } : {}),
          ...(parsedUser.language_code ? { language_code: parsedUser.language_code } : {}),
        });
        const user = toPublicUser(stored);
        return reply.send({ authMode: "stub", user, accessToken: await maybeMint(env, user) });
      }
      const user = publicUser({
        id: `tg:${parsedUser.id}`,
        telegramId: String(parsedUser.id),
        username: parsedUser.username ?? null,
        displayName: parsedUser.first_name,
        locale: localeFromTelegram(parsedUser.language_code),
      });
      return reply.send({
        authMode: "stub",
        user,
        accessToken: await maybeMint(env, user),
      });
    }

    const verified = verifyTelegramInitData(body.data.initData, {
      botToken: env.TELEGRAM_BOT_TOKEN,
      nowMs: Date.now(),
      maxAgeSeconds: env.TELEGRAM_AUTH_MAX_AGE_SECONDS,
    });
    if (!verified.ok) {
      return reply.code(401).send({ error: verified.reason });
    }

    const stored = prisma ? await upsertTelegramUser(prisma, verified.user) : null;
    const user = stored
      ? toPublicUser(stored)
      : publicUser({
          id: `tg:${verified.user.id}`,
          telegramId: String(verified.user.id),
          username: verified.user.username ?? null,
          displayName: verified.user.first_name,
          locale: localeFromTelegram(verified.user.language_code),
        });
    return reply.send({
      authMode: "verified",
      user,
      accessToken: await maybeMint(env, user),
    });
  });

  app.post("/auth/dev", async (request, reply) => {
    if (!env.ALLOW_STUB_AUTH) {
      return reply.code(403).send({ error: "stub_auth_disabled" });
    }
    const body = devAuthRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    if (!prisma) {
      return reply.code(503).send({ error: "database_unconfigured" });
    }
    if (!env.JWT_SECRET) {
      return reply.code(503).send({ error: "jwt_unconfigured" });
    }
    const stored = await upsertDevUser(prisma, body.data.displayName);
    const admins = new Set((env.DEV_ADMIN_NAMES ?? "").split(",").map((name) => name.trim()).filter(Boolean));
    if (admins.has(stored.displayName)) {
      await prisma.user.update({ where: { id: stored.id }, data: { role: "ADMIN" } });
    }
    const user = toPublicUser(stored);
    return reply.send({
      authMode: "stub",
      user,
      accessToken: await maybeMint(env, user),
      refreshToken: issueRefresh(user.id),
    });
  });

  app.post("/auth/password", async (_request, reply) => {
    return reply.code(501).send({ error: "not_available", method: "password" });
  });

  app.post("/auth/passkey", async (_request, reply) => {
    return reply.code(501).send({ error: "not_available", method: "passkey" });
  });

  app.post("/auth/token", async (request, reply) => {
    if (!env.ALLOW_STUB_AUTH) {
      return reply.code(403).send({ error: "stub_auth_disabled" });
    }
    const body = accessTokenRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    if (!env.JWT_SECRET) {
      return reply.code(503).send({ error: "jwt_unconfigured" });
    }
    const accessToken = await mintAccessToken({
      secret: env.JWT_SECRET,
      userId: body.data.userId,
      telegramId: body.data.telegramId ?? null,
      displayName: body.data.displayName ?? "Гость",
      ttlSeconds: env.JWT_TTL_SECONDS,
    });
    return reply.send({ accessToken, tokenType: "Bearer" });
  });

  app.post("/auth/telegram-widget", async (request, reply) => {
    const body = z.object({ id: z.string(), auth_date: z.string(), hash: z.string(), first_name: z.string().optional() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!env.TELEGRAM_BOT_TOKEN) return reply.code(501).send({ error: "telegram_unconfigured" });
    const fields = Object.fromEntries(Object.entries(body.data).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    const ok = verifyLoginWidget(fields, env.TELEGRAM_BOT_TOKEN, Date.now(), env.TELEGRAM_AUTH_MAX_AGE_SECONDS);
    if (!ok) return reply.code(401).send({ error: "bad_hash" });
    return reply.send({ ok: true, telegramId: body.data.id });
  });

  app.get("/auth/linked-accounts", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor) return;
    if (!prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    return reply.send({ email: Boolean(user?.email), telegram: Boolean(user?.telegramId) });
  });

  app.post("/auth/link-telegram", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor) return;
    if (!prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const body = z.object({ telegramId: z.string().regex(/^\d+$/) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const taken = await prisma.user.findFirst({ where: { telegramId: BigInt(body.data.telegramId), NOT: { id: actor.userId } } });
    if (taken) return reply.code(409).send({ error: "Telegram account already linked to another user" });
    await prisma.user.update({ where: { id: actor.userId }, data: { telegramId: BigInt(body.data.telegramId) } });
    return reply.send({ linked: true });
  });

  app.post("/auth/unlink-telegram", async (request, reply) => {
    const actor = await requireUser(request, reply, env);
    if (!actor) return;
    if (!prisma) return reply.code(503).send({ error: "database_unconfigured" });
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    if (!unlinkAllowed(Boolean(user?.email))) return reply.code(400).send({ error: "email_required" });
    await prisma.user.update({ where: { id: actor.userId }, data: { telegramId: null } });
    return reply.send({ linked: false });
  });
}

async function maybeMint(env: ApiEnv, user: User): Promise<string | null> {
  if (!env.JWT_SECRET) {
    return null;
  }
  return mintAccessToken({
    secret: env.JWT_SECRET,
    userId: user.id,
    telegramId: user.telegramId,
    displayName: user.displayName,
    ttlSeconds: env.JWT_TTL_SECONDS,
  });
}
