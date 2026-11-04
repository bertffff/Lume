import type { Redis } from "ioredis";

export interface VoicePresence {
  userId: string;
  muted: boolean;
  speaking: boolean;
}

function voiceKey(roomId: string): string {
  return `lume:room:${roomId}:voice`;
}

export async function setVoicePresence(redis: Redis, roomId: string, presence: VoicePresence): Promise<VoicePresence[]> {
  await redis.hset(voiceKey(roomId), presence.userId, JSON.stringify(presence));
  return listVoicePresence(redis, roomId);
}

export async function clearVoicePresence(redis: Redis, roomId: string, userId: string): Promise<VoicePresence[]> {
  await redis.hdel(voiceKey(roomId), userId);
  return listVoicePresence(redis, roomId);
}

export async function listVoicePresence(redis: Redis, roomId: string): Promise<VoicePresence[]> {
  const raw = await redis.hgetall(voiceKey(roomId));
  const members: VoicePresence[] = [];
  for (const value of Object.values(raw)) {
    try {
      const parsed = JSON.parse(value) as VoicePresence;
      if (parsed.userId && typeof parsed.muted === "boolean" && typeof parsed.speaking === "boolean") {
        members.push(parsed);
      }
    } catch {
      // Ignore a corrupt field.
    }
  }
  return members;
}
