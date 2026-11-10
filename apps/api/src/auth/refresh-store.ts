import { randomBytes } from "node:crypto";
import { rotateRefresh } from "@lume/contracts";

const refreshTokens = new Map<string, { userId: string; expiresAt: number }>();
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function issueRefresh(userId: string, nowMs = Date.now()): string {
  const token = randomBytes(24).toString("hex");
  refreshTokens.set(token, { userId, expiresAt: nowMs + WEEK });
  return token;
}

export function revokeRefresh(token: string): void {
  refreshTokens.delete(token);
}

export function rotateStoredRefresh(current: string, nowMs = Date.now()): { userId: string; refreshToken: string } | null {
  const next = randomBytes(24).toString("hex");
  const userId = rotateRefresh(refreshTokens, current, next, nowMs, WEEK);
  if (!userId) return null;
  return { userId, refreshToken: next };
}
