import { formatRoomCode, FREE_ROOM_MEMBER_CAP, parseRoomCode } from "@lume/contracts";
import { describe, expect, it, vi } from "vitest";
import { createMemoryRepository } from "./memory.js";
import { createRoomCode, RoomService } from "./service.js";
import { RoomFailure } from "./types.js";

function harness() {
  let next = 0;
  const service = new RoomService(
    createMemoryRepository(),
    () => `id-${next++}`,
    () => new Date("2026-11-04T12:00:00.000Z"),
  );
  return service;
}

describe("room service", () => {
  it("creates a room for the host and lets a second user join by code", async () => {
    const service = harness();
    const created = await service.createRoom(
      { userId: "anya", displayName: "Аня" },
      { title: "Вечерний зал", isPublic: true },
    );
    expect(created.self.role).toBe("host");
    expect(parseRoomCode(created.room.code)).toBe(created.room.code);
    expect(created.room.memberCount).toBe(1);

    const joined = await service.joinByCode(
      { userId: "mark", displayName: "Марк" },
      ` ${formatRoomCode(created.room.code)} `,
    );
    expect(joined.self.role).toBe("viewer");
    expect(joined.members.map((member) => member.displayName)).toEqual(["Аня", "Марк"]);
    expect((await service.listPublic()).map((room) => room.code)).toEqual([created.room.code]);
  });

  it("retries an insert-time code collision without pre-checking or changing the room ID", async () => {
    const repo = createMemoryRepository();
    const lookup = vi.spyOn(repo, "findRoomByCode");
    const insert = vi.spyOn(repo, "insertRoom").mockResolvedValueOnce(false);
    const code = vi.fn().mockReturnValueOnce("aaaaaa").mockReturnValueOnce("bbbbbb");
    const service = new RoomService(repo, () => "stable-id", undefined, undefined, code);
    const created = await service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Зал" });
    expect(lookup).not.toHaveBeenCalled();
    expect(insert.mock.calls.map(([room]) => [room.id, room.code])).toEqual([
      ["stable-id", "aaaaaa"], ["stable-id", "bbbbbb"],
    ]);
    expect(created.room).toMatchObject({ id: "stable-id", code: "bbbbbb" });
  });

  it("bounds collision retries and never adds a member to a failed room", async () => {
    const repo = createMemoryRepository();
    const insert = vi.spyOn(repo, "insertRoom").mockResolvedValue(false);
    const member = vi.spyOn(repo, "saveMember");
    const service = new RoomService(repo, undefined, undefined, undefined, () => "aaaaaa");
    await expect(service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Зал" })).rejects.toMatchObject({ code: "conflict" });
    expect(insert).toHaveBeenCalledTimes(8);
    expect(member).not.toHaveBeenCalled();
  });

  it("rejects a legacy code without a lookup or truncation", async () => {
    const repo = createMemoryRepository();
    const lookup = vi.spyOn(repo, "findRoomByCode");
    const service = new RoomService(repo);
    await expect(service.joinByCode({ userId: "guest", displayName: "Гость" }, "7kq2mxzz")).rejects.toMatchObject({ code: "not_found" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("generates canonical codes", () => {
    const codes = Array.from({ length: 20 }, () => createRoomCode());
    expect(codes.every((code) => parseRoomCode(code) === code)).toBe(true);
  });

  it("hides a public room from the open list once everyone has left", async () => {
    const service = harness();
    const created = await service.createRoom(
      { userId: "anya", displayName: "Аня" },
      { title: "Заброшенный зал", isPublic: true },
    );
    expect((await service.listPublic()).map((room) => room.code)).toEqual([created.room.code]);

    await service.leave({ userId: "anya", displayName: "Аня" }, created.room.id);

    expect(await service.listPublic()).toEqual([]);
  });

  it("stops a free room at 25 members", async () => {
    const service = harness();
    const created = await service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Полный" });
    for (let index = 1; index < FREE_ROOM_MEMBER_CAP; index += 1) {
      await service.joinByCode({ userId: `user-${index}`, displayName: `Гость ${index}` }, created.room.code);
    }
    await expect(
      service.joinByCode({ userId: "overflow", displayName: "Лишний" }, created.room.code),
    ).rejects.toMatchObject({ code: "room_full" });
  });

  it("lets the host and a mod moderate, and blocks a muted viewer from chat", async () => {
    const service = harness();
    const created = await service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Зал" });
    await service.joinByCode({ userId: "mod", displayName: "Мод" }, created.room.code);
    await service.joinByCode({ userId: "view", displayName: "Зритель" }, created.room.code);
    await service.setRole({ userId: "host", displayName: "Хост" }, created.room.id, "mod", "mod");

    await expect(
      service.kick({ userId: "view", displayName: "Зритель" }, created.room.id, "mod"),
    ).rejects.toBeInstanceOf(RoomFailure);
    await service.kick({ userId: "mod", displayName: "Мод" }, created.room.id, "view");
    await service.joinByCode({ userId: "view", displayName: "Зритель" }, created.room.code);
    await service.mute({ userId: "host", displayName: "Хост" }, created.room.id, "view", true);
    await expect(
      service.sendMessage({ userId: "view", displayName: "Зритель" }, created.room.id, "привет"),
    ).rejects.toMatchObject({ code: "muted" });

    const message = await service.sendMessage(
      { userId: "host", displayName: "Хост" },
      created.room.id,
      "привет",
    );
    const reacted = await service.react(
      { userId: "mod", displayName: "Мод" },
      created.room.id,
      message.id,
      "🔥",
    );
    expect(reacted.reactions).toEqual([{ emoji: "🔥", userId: "mod" }]);
  });

  it("queues an embed and lets only the host play the next item", async () => {
    const service = harness();
    const created = await service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Экран" });
    await service.joinByCode({ userId: "view", displayName: "Зритель" }, created.room.code);
    await expect(
      service.playNext({ userId: "view", displayName: "Зритель" }, created.room.id),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(service.addQueueItem({ userId: "host", displayName: "Хост" }, created.room.id, "nope")).rejects.toMatchObject({
      code: "invalid_media",
    });
    await service.addQueueItem(
      { userId: "host", displayName: "Хост" },
      created.room.id,
      "https://youtu.be/dQw4w9WgXcQ",
    );
    const playing = await service.playNext({ userId: "host", displayName: "Хост" }, created.room.id);
    expect(playing.room.nowPlaying?.provider).toBe("youtube");
    expect(playing.room.status).toBe("live");
  });

  it("hands the host to a mod when the host leaves, and the owner takes it back", async () => {
    const service = harness();
    const created = await service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Смена" });
    await service.joinByCode({ userId: "mod", displayName: "Мод" }, created.room.code);
    await service.setRole({ userId: "host", displayName: "Хост" }, created.room.id, "mod", "mod");
    await service.leave({ userId: "host", displayName: "Хост" }, created.room.id);
    const after = await service.joinByCode({ userId: "guest", displayName: "Гость" }, created.room.code);
    expect(after.members.find((member) => member.userId === "mod")?.role).toBe("host");
    const reclaimed = await service.joinByCode({ userId: "host", displayName: "Хост" }, created.room.code);
    expect(reclaimed.self.role).toBe("host");
    expect(reclaimed.messages.some((message) => message.body.includes("забрал хост"))).toBe(true);
    expect(reclaimed.members.find((member) => member.userId === "mod")?.role).toBe("viewer");
  });

  it("transfers the host and rejects a duplicate queue url", async () => {
    const service = harness();
    const created = await service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Передача" });
    await service.joinByCode({ userId: "next", displayName: "Следующий" }, created.room.code);
    const moved = await service.transferHost({ userId: "host", displayName: "Хост" }, created.room.id, "next");
    expect(moved.members.find((member) => member.userId === "next")?.role).toBe("host");
    await service.addQueueItem({ userId: "next", displayName: "Следующий" }, created.room.id, "https://youtu.be/dQw4w9WgXcQ");
    await expect(
      service.addQueueItem({ userId: "next", displayName: "Следующий" }, created.room.id, "https://youtu.be/dQw4w9WgXcQ"),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("stops a fourth distinct reaction from the same person", async () => {
    const service = harness();
    const created = await service.createRoom({ userId: "host", displayName: "Хост" }, { title: "Чат" });
    const message = await service.sendMessage({ userId: "host", displayName: "Хост" }, created.room.id, "раз");
    for (const emoji of ["👍", "🔥", "😂"]) {
      await service.react({ userId: "host", displayName: "Хост" }, created.room.id, message.id, emoji);
    }
    await expect(
      service.react({ userId: "host", displayName: "Хост" }, created.room.id, message.id, "❤️"),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});
