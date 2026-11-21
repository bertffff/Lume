import { randomBytes } from "node:crypto";
import { rotateRefresh } from "@lume/contracts";
import type { RedisLike } from "../redis.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAGIC_TTL_MS = 15 * 60_000;

export interface RefreshStore {
  issue(userId: string, nowMs?: number): Promise<string>;
  rotate(
    current: string,
    nowMs?: number,
  ): Promise<{ userId: string; refreshToken: string } | null>;
  revoke(token: string): Promise<void>;
}

export interface MagicLinkStore {
  issue(email: string, nowMs?: number): Promise<{ token: string; expiresAt: number }>;
  /** Single use: a valid token is removed before the email is returned. */
  consume(token: string, nowMs?: number): Promise<string | null>;
}

export interface AuthStores {
  refresh: RefreshStore;
  magic: MagicLinkStore;
}

export interface AuthStoreOptions {
  /** Redis is the production store; `null` keeps development and tests in memory. */
  redis?: RedisLike | null;
  /** Namespace so parallel test runs and replicas never share rows. */
  keyPrefix?: string;
}

function refreshKey(prefix: string, token: string): string {
  return `${prefix}:auth:refresh:${token}`;
}

function magicKey(prefix: string, token: string): string {
  return `${prefix}:auth:magic:${token}`;
}

function newToken(): string {
  return randomBytes(24).toString("hex");
}

interface RefreshRow {
  userId: string;
  expiresAt: number;
}

function parseRefresh(raw: string | null): RefreshRow | null {
  if (!raw) return null;
  try {
    const row = JSON.parse(raw) as Partial<RefreshRow>;
    if (typeof row.userId !== "string" || typeof row.expiresAt !== "number") return null;
    return { userId: row.userId, expiresAt: row.expiresAt };
  } catch {
    return null;
  }
}

interface MagicRow {
  email: string;
  expiresAt: number;
}

function parseMagic(raw: string | null): MagicRow | null {
  if (!raw) return null;
  try {
    const row = JSON.parse(raw) as Partial<MagicRow>;
    if (typeof row.email !== "string" || typeof row.expiresAt !== "number") return null;
    return { email: row.email, expiresAt: row.expiresAt };
  } catch {
    return null;
  }
}

function createMemoryStores(prefix: string): AuthStores {
  const refreshTokens = new Map<string, { userId: string; expiresAt: number }>();
  const magicLinks = new Map<string, { email: string; expiresAt: number; used: boolean }>();
  return {
    refresh: {
      issue: async (userId, nowMs = Date.now()) => {
        const token = newToken();
        refreshTokens.set(token, { userId, expiresAt: nowMs + WEEK_MS });
        return token;
      },
      rotate: async (current, nowMs = Date.now()) => {
        const next = newToken();
        const userId = rotateRefresh(refreshTokens, current, next, nowMs, WEEK_MS);
        return userId ? { userId, refreshToken: next } : null;
      },
      revoke: async (token) => {
        refreshTokens.delete(token);
      },
    },
    magic: {
      issue: async (email, nowMs = Date.now()) => {
        const token = randomBytes(16).toString("hex");
        const expiresAt = nowMs + MAGIC_TTL_MS;
        magicLinks.set(token, { email, expiresAt, used: false });
        return { token, expiresAt };
      },
      consume: async (token, nowMs = Date.now()) => {
        void prefix;
        const row = magicLinks.get(token);
        if (!row || row.used || row.expiresAt <= nowMs) return null;
        row.used = true;
        return row.email;
      },
    },
  };
}

function createRedisStores(redis: RedisLike, prefix: string): AuthStores {
  return {
    refresh: {
      issue: async (userId, nowMs = Date.now()) => {
        const token = newToken();
        const row: RefreshRow = { userId, expiresAt: nowMs + WEEK_MS };
        await redis.setWithTtl(refreshKey(prefix, token), JSON.stringify(row), WEEK_MS);
        return token;
      },
      rotate: async (current, nowMs = Date.now()) => {
        const row = parseRefresh(await redis.take(refreshKey(prefix, current)));
        if (!row || row.expiresAt <= nowMs) return null;
        const refreshToken = newToken();
        const next: RefreshRow = { userId: row.userId, expiresAt: nowMs + WEEK_MS };
        await redis.setWithTtl(refreshKey(prefix, refreshToken), JSON.stringify(next), WEEK_MS);
        return { userId: row.userId, refreshToken };
      },
      revoke: async (token) => {
        await redis.delete(refreshKey(prefix, token));
      },
    },
    magic: {
      issue: async (email, nowMs = Date.now()) => {
        const token = randomBytes(16).toString("hex");
        const expiresAt = nowMs + MAGIC_TTL_MS;
        const row: MagicRow = { email, expiresAt };
        await redis.setWithTtl(magicKey(prefix, token), JSON.stringify(row), MAGIC_TTL_MS);
        return { token, expiresAt };
      },
      consume: async (token, nowMs = Date.now()) => {
        const row = parseMagic(await redis.take(magicKey(prefix, token)));
        if (!row || row.expiresAt <= nowMs) return null;
        return row.email;
      },
    },
  };
}

/**
 * Auth state lives in Redis when it is configured. Development and tests keep
 * the same interface in memory so they stay offline.
 */
export function createAuthStores(options: AuthStoreOptions = {}): AuthStores {
  const prefix = options.keyPrefix ?? "lume";
  return options.redis ? createRedisStores(options.redis, prefix) : createMemoryStores(prefix);
}
