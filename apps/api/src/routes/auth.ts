import {
  accessTokenRequestSchema,
  telegramAuthRequestSchema,
  type User,
} from "@lume/contracts";
import { devAuthRequestSchema } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import type { FastifyInstance } from "fastify";
import type { ApiEnv } from "../env.js";
import { mintAccessToken } from "../auth/jwt.js";
import { localeFromTelegram, verifyTelegramInitData } from "../auth/telegram.js";
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
    const user = toPublicUser(stored);
    return reply.send({
      authMode: "stub",
      user,
      accessToken: await maybeMint(env, user),
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
