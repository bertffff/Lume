import { expect, it } from "vitest";
import { createMemoryRepository } from "./memory.js";
import { RoomService } from "./service.js";

it("applies category, visibility and active seat capacity in the memory repository", async () => {
  const viewer = { userId: "viewer", displayName: "Viewer" };
  const friend = { userId: "friend", displayName: "Friend" };
  const repo = createMemoryRepository({ contacts: [{ requesterId: friend.userId, addresseeId: viewer.userId, status: "accepted" }] });
  const service = new RoomService(repo, undefined, undefined, async () => ({ title: "Concert", thumbnailUrl: null, durationMs: null }));
  const { room } = await service.createRoom(friend, { title: "Public", isPublic: true, categorySelection: "other" });
  const privateRoom = await service.createRoom(friend, { title: "Private", categorySelection: "music" });
  const stored = await repo.findRoomById(room.id);
  if (!stored) throw new Error("Missing room fixture");
  const capped = { ...stored, id: `${room.id}-full`, code: "7kq2mx", maxMembers: 1 };
  await repo.insertRoom(capped);
  await repo.saveMember({ roomId: capped.id, userId: friend.userId, displayName: friend.displayName, role: "host", muted: false, leftAt: null });
  const catalog = (filter: "friends" | "music") => service.catalog({ viewerId: viewer.userId, filter, after: null });
  expect((await catalog("friends")).rooms).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: room.id, isFull: false }),
    expect.objectContaining({ id: capped.id, isFull: true, memberCount: 1 }),
  ]));
  expect((await catalog("friends")).rooms.some(({ id }) => id === privateRoom.room.id)).toBe(false);
  expect((await service.addQueueItem(friend, room.id, "https://example.test/media.mp4")).room.category).toBe("other");
  expect((await service.playNext(friend, room.id)).room.category).toBe("other");
  expect((await service.setCategory(friend, room.id, "auto")).room.category).toBe("music");
  expect((await catalog("music")).rooms).toMatchObject([{ id: room.id, mediaPreview: { provider: "direct", title: "Concert", thumbnailUrl: null } }]);
});
