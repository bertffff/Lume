import type { PresenceMember } from "@lume/contracts";
import type { Redis } from "ioredis";
import { hostKey, presenceKey } from "./keys.js";

function parseMember(raw: string): PresenceMember | null {
  try {
    const value = JSON.parse(raw) as PresenceMember;
    if (!value.userId || !value.displayName || typeof value.joinedAtMs !== "number") {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export async function listMembers(redis: Redis, roomId: string): Promise<PresenceMember[]> {
  const raw = await redis.hgetall(presenceKey(roomId));
  const members: PresenceMember[] = [];
  for (const value of Object.values(raw)) {
    const member = parseMember(value);
    if (member) {
      members.push(member);
    }
  }
  members.sort((left, right) => left.joinedAtMs - right.joinedAtMs);
  return members;
}

export async function joinRoom(
  redis: Redis,
  roomId: string,
  member: PresenceMember,
): Promise<{ hostId: string; members: PresenceMember[] }> {
  await redis.set(hostKey(roomId), member.userId, "NX");
  const hostId = (await redis.get(hostKey(roomId))) ?? member.userId;
  await redis.hset(presenceKey(roomId), member.userId, JSON.stringify(member));
  return { hostId, members: await listMembers(redis, roomId) };
}

export async function leaveRoom(
  redis: Redis,
  roomId: string,
  userId: string,
): Promise<PresenceMember[]> {
  await redis.hdel(presenceKey(roomId), userId);
  return listMembers(redis, roomId);
}

export async function readHost(redis: Redis, roomId: string): Promise<string | null> {
  return redis.get(hostKey(roomId));
}
