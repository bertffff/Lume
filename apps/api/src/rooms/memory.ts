import { banBlocksJoin, type BanRow } from "../access/gates.js";
import { RoomFailure, type MemberRecord, type MessageRecord, type QueueRecord, type RoomRecord, type RoomRepository } from "./types.js";

interface MemoryCatalogAccess {
  contacts?: readonly { requesterId: string; addresseeId: string; status: "accepted" | "pending" | "blocked" }[];
  bans?: readonly (BanRow & { userId: string })[];
  hiddenUsers?: ReadonlySet<string>;
}

const descending = (left: string, right: string) => left < right ? 1 : left > right ? -1 : 0;

export function createMemoryRepository(access: MemoryCatalogAccess = {}): RoomRepository {
  const rooms = new Map<string, RoomRecord>();
  const members: MemberRecord[] = [];
  const messages: MessageRecord[] = [];
  const queue: QueueRecord[] = [];

  return {
    async insertRoom(room) {
      if (rooms.has(room.id)) throw new Error("Duplicate room ID");
      if ([...rooms.values()].some(({ code }) => code === room.code)) return false;
      rooms.set(room.id, room);
      return true;
    },
    async patchRoom(id, patch) {
      const room = rooms.get(id);
      if (!room) {
        return;
      }
      rooms.set(id, { ...room, ...patch });
    },
    async startPlaying(roomId, itemId) {
      const room = rooms.get(roomId);
      const index = queue.findIndex((entry) => entry.id === itemId && entry.roomId === roomId);
      const item = queue[index];
      if (!room || !item) throw new RoomFailure("not_found");
      queue[index] = { ...item, played: true };
      rooms.set(roomId, { ...room, status: "live", nowPlayingId: itemId,
        category: room.categorySelection === "auto" ? item.inferredCategory : room.categorySelection });
    },
    async setCategory(roomId, hostId, categorySelection) {
      const room = rooms.get(roomId);
      if (!room) throw new RoomFailure("not_found");
      if (!members.some((member) => member.roomId === roomId && member.userId === hostId && member.role === "host" && member.leftAt === null)) {
        throw new RoomFailure("forbidden");
      }
      const current = queue.find((item) => item.id === room.nowPlayingId);
      rooms.set(roomId, { ...room, categorySelection,
        category: categorySelection === "auto" ? current?.inferredCategory ?? "other" : categorySelection });
    },
    async findRoomById(id) {
      return rooms.get(id) ?? null;
    },
    async findRoomByCode(code) {
      return [...rooms.values()].find((room) => room.code === code) ?? null;
    },
    async listPublicRooms() {
      return [...rooms.values()]
        .filter((room) => room.isPublic && room.status !== "ended")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async listCatalog({ viewerId, filter, after, take, now }) {
      const edges = (access.contacts ?? []).flatMap(({ requesterId, addresseeId, status }) =>
        requesterId === viewerId ? [{ id: addresseeId, status }] : addresseeId === viewerId ? [{ id: requesterId, status }] : []);
      const isBlocked = (id: string) => edges.some((edge) => edge.id === id && edge.status === "blocked");
      const isBanned = (userId: string | null, room: RoomRecord) => banBlocksJoin(
        (access.bans ?? []).filter((ban) => ban.userId === userId), { id: room.id, ownerId: room.ownerId ?? room.hostId }, now,
      );
      return [...rooms.values()].sort((a, b) => descending(a.createdAt, b.createdAt) || descending(a.id, b.id))
        .flatMap((room) => {
          const { id, code, title, hostId, status, isPublic, category, createdAt } = room;
          if (!isPublic || status === "ended" || isBlocked(hostId) || isBlocked(room.ownerId ?? hostId) || isBanned(viewerId, room)) return [];
          if (after && (createdAt > after[0] || (createdAt === after[0] && id >= after[1]))) return [];
          const active = members.filter((member) => member.roomId === id && member.leftAt === null);
          if (active.length === 0 || active.some((member) => member.role === "host" && isBlocked(member.userId))) return [];
          if (filter === "friends" && !active.some(({ userId }) => !isBlocked(userId) && !access.hiddenUsers?.has(userId)
            && !isBanned(userId, room) && edges.some((edge) => edge.id === userId)
            && !edges.some((edge) => edge.id === userId && edge.status !== "accepted"))) return [];
          if (filter !== "all" && filter !== "friends" && filter !== category) return [];
          const playing = queue.find((item) => item.id === room.nowPlayingId);
          const mediaPreview = playing ? { provider: playing.provider, title: playing.title, thumbnailUrl: playing.thumbnailUrl } : null;
          return [{ id, code, title, hostId, status, isPublic, category, createdAt, memberCount: active.length,
            isFull: active.length >= room.maxMembers, mediaPreview }];
        }).slice(0, take);
    },
    async listMembers(roomId) {
      return members.filter((member) => member.roomId === roomId);
    },
    async findMember(roomId, userId) {
      return members.find((member) => member.roomId === roomId && member.userId === userId) ?? null;
    },
    async saveMember(member) {
      const index = members.findIndex(
        (item) => item.roomId === member.roomId && item.userId === member.userId,
      );
      if (index >= 0) {
        members[index] = member;
        return;
      }
      members.push(member);
    },
    async listMessages(roomId, limit) {
      return messages.filter((message) => message.roomId === roomId).slice(-limit);
    },
    async insertMessage(message) {
      messages.push(message);
    },
    async toggleReaction({ roomId, messageId, userId, emoji }) {
      const message = messages.find((item) => item.id === messageId && item.roomId === roomId);
      if (!message) {
        return null;
      }
      const existing = message.reactions.findIndex(
        (reaction) => reaction.userId === userId && reaction.emoji === emoji,
      );
      if (existing >= 0) {
        message.reactions.splice(existing, 1);
      } else {
        message.reactions.push({ userId, emoji });
      }
      return message;
    },
    async listQueue(roomId) {
      return queue
        .filter((item) => item.roomId === roomId)
        .sort((left, right) => left.position - right.position);
    },
    async insertQueueItem(item) {
      queue.push(item);
    },
  };
}
