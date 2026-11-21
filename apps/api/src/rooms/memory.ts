import type { MemberRecord, MessageRecord, QueueRecord, RoomRecord, RoomRepository } from "./types.js";

export function createMemoryRepository(): RoomRepository {
  const rooms = new Map<string, RoomRecord>();
  const members: MemberRecord[] = [];
  const messages: MessageRecord[] = [];
  const queue: QueueRecord[] = [];

  return {
    async insertRoom(room) {
      rooms.set(room.id, room);
    },
    async patchRoom(id, patch) {
      const room = rooms.get(id);
      if (!room) {
        return;
      }
      rooms.set(id, { ...room, ...patch });
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
    async saveQueueItem(item) {
      const index = queue.findIndex((current) => current.id === item.id);
      if (index >= 0) {
        queue[index] = item;
      }
    },
  };
}
