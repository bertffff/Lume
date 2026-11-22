export interface VoiceRedis {
  hset(key: string, field: string, value: string): Promise<unknown>;
  hdel(key: string, field: string): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, string>>;
}

export interface VoicePresence {
  userId: string;
  muted: boolean;
  speaking: boolean;
  joinedAtMs: number;
}

export interface VoicePresenceUpdate {
  userId: string;
  muted: boolean;
  speaking: boolean;
  joinedAtMs?: number;
}

function voiceKey(roomId: string): string {
  return `lume:room:${roomId}:voice`;
}

export async function setVoicePresence(
  redis: VoiceRedis,
  roomId: string,
  presence: VoicePresenceUpdate,
): Promise<VoicePresence[]> {
  const current = (await listVoicePresence(redis, roomId)).find((member) => member.userId === presence.userId);
  const next: VoicePresence = {
    userId: presence.userId,
    muted: presence.muted,
    speaking: presence.speaking,
    joinedAtMs: current?.joinedAtMs ?? presence.joinedAtMs ?? Date.now(),
  };
  await redis.hset(voiceKey(roomId), next.userId, JSON.stringify(next));
  return listVoicePresence(redis, roomId);
}

export async function clearVoicePresence(redis: VoiceRedis, roomId: string, userId: string): Promise<VoicePresence[]> {
  await redis.hdel(voiceKey(roomId), userId);
  return listVoicePresence(redis, roomId);
}

export async function listVoicePresence(redis: VoiceRedis, roomId: string): Promise<VoicePresence[]> {
  const raw = await redis.hgetall(voiceKey(roomId));
  const members: VoicePresence[] = [];
  for (const value of Object.values(raw)) {
    try {
      const parsed = JSON.parse(value) as Partial<VoicePresence>;
      if (parsed.userId && typeof parsed.muted === "boolean" && typeof parsed.speaking === "boolean") {
        members.push({
          userId: parsed.userId,
          muted: parsed.muted,
          speaking: parsed.speaking,
          joinedAtMs: typeof parsed.joinedAtMs === "number" ? parsed.joinedAtMs : Date.now(),
        });
      }
    } catch {
      // Ignore a corrupt field.
    }
  }
  return members.sort((left, right) => left.joinedAtMs - right.joinedAtMs);
}
