import { describe, expect, it } from "vitest";
import { clearVoicePresence, listVoicePresence, setVoicePresence } from "./voice.js";

function memoryRedis() {
  const hashes = new Map<string, Map<string, string>>();
  return {
    async hset(key: string, field: string, value: string) {
      const hash = hashes.get(key) ?? new Map<string, string>();
      hash.set(field, value);
      hashes.set(key, hash);
      return 1;
    },
    async hdel(key: string, field: string) {
      return hashes.get(key)?.delete(field) ? 1 : 0;
    },
    async hgetall(key: string) {
      return Object.fromEntries(hashes.get(key) ?? []);
    },
  };
}

describe("voice presence", () => {
  it("keeps the join time when mute and speaking updates arrive", async () => {
    const redis = memoryRedis();
    const joined = await setVoicePresence(redis, "room-a", {
      userId: "alice",
      muted: false,
      speaking: false,
      joinedAtMs: 1_000,
    });
    expect(joined[0]).toMatchObject({ userId: "alice", muted: false, joinedAtMs: 1_000 });

    const muted = await setVoicePresence(redis, "room-a", {
      userId: "alice",
      muted: true,
      speaking: false,
    });
    expect(muted[0]).toMatchObject({ userId: "alice", muted: true, speaking: false, joinedAtMs: 1_000 });

    const speaking = await setVoicePresence(redis, "room-a", {
      userId: "alice",
      muted: false,
      speaking: true,
    });
    expect(speaking[0]).toMatchObject({ userId: "alice", muted: false, speaking: true, joinedAtMs: 1_000 });
  });

  it("returns participants ordered by join time and drops a leaver", async () => {
    const redis = memoryRedis();
    await setVoicePresence(redis, "room-b", { userId: "late", muted: false, speaking: false, joinedAtMs: 3_000 });
    await setVoicePresence(redis, "room-b", { userId: "early", muted: false, speaking: false, joinedAtMs: 1_000 });
    const members = await listVoicePresence(redis, "room-b");
    expect(members.map((member) => member.userId)).toEqual(["early", "late"]);
    expect(members.map((member) => member.joinedAtMs)).toEqual([1_000, 3_000]);

    const rest = await clearVoicePresence(redis, "room-b", "early");
    expect(rest.map((member) => member.userId)).toEqual(["late"]);
  });
});
