import { defaultRoomLayout, embedProviderSchema, type EmbedProvider } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import type { MessageRecord, QueueRecord, RoomRecord, RoomRepository } from "./types.js";

function asProvider(value: string): EmbedProvider {
  const parsed = embedProviderSchema.safeParse(value);
  return parsed.success ? parsed.data : "direct";
}

function mapRoom(room: {
  id: string;
  slug: string;
  title: string;
  hostId: string;
  ownerId: string;
  status: "open" | "live" | "ended";
  isPublic: boolean;
  maxMembers: number;
  defaultPermissions: unknown;
  createdAt: Date;
  nowPlayingId: string | null;
}): RoomRecord {
  return {
    id: room.id,
    code: room.slug,
    title: room.title,
    hostId: room.hostId,
    ownerId: room.ownerId,
    status: room.status,
    isPublic: room.isPublic,
    maxMembers: room.maxMembers,
    defaultPermissions:
      room.defaultPermissions && typeof room.defaultPermissions === "object"
        ? (room.defaultPermissions as Record<string, boolean>)
        : null,
    createdAt: room.createdAt.toISOString(),
    nowPlayingId: room.nowPlayingId,
  };
}

export function createPrismaRepository(prisma: PrismaClient): RoomRepository {
  return {
    async insertRoom(room) {
      await prisma.room.create({
        data: {
          id: room.id,
          slug: room.code,
          title: room.title,
          hostId: room.hostId,
          ownerId: room.hostId,
          status: room.status,
          isPublic: room.isPublic,
          maxMembers: room.maxMembers,
          layout: defaultRoomLayout,
          videoAspect: defaultRoomLayout.videoAspect,
          createdAt: new Date(room.createdAt),
        },
      });
    },
    async patchRoom(id, patch) {
      await prisma.room.update({
        where: { id },
        data: {
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.nowPlayingId !== undefined ? { nowPlayingId: patch.nowPlayingId } : {}),
        },
      });
    },
    async findRoomById(id) {
      const room = await prisma.room.findUnique({ where: { id } });
      return room ? mapRoom(room) : null;
    },
    async findRoomByCode(code) {
      const room = await prisma.room.findUnique({ where: { slug: code } });
      return room ? mapRoom(room) : null;
    },
    async listPublicRooms() {
      const rooms = await prisma.room.findMany({
        where: { isPublic: true, status: { not: "ended" } },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return rooms.map(mapRoom);
    },
    async listMembers(roomId) {
      const rows = await prisma.roomMember.findMany({
        where: { roomId },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      });
      return rows.map((row) => ({
        roomId,
        userId: row.userId,
        displayName: row.user.displayName,
        role: row.role,
        muted: row.muted,
        leftAt: row.leftAt ? row.leftAt.toISOString() : null,
        joinedAt: row.joinedAt.toISOString(),
        permissionsOverridden: row.permissionsOverridden,
        canChat: row.canChat,
        canSpeak: row.canSpeak,
        canReact: row.canReact,
        canSeek: row.canSeek,
        canInvite: row.canInvite,
        canControlVideo: row.canControlVideo,
        canAddToQueue: row.canAddToQueue,
        canRemoveFromQueue: row.canRemoveFromQueue,
        canReorderQueue: row.canReorderQueue,
      }));
    },
    async findMember(roomId, userId) {
      const row = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
        include: { user: true },
      });
      if (!row) {
        return null;
      }
      return {
        roomId,
        userId,
        displayName: row.user.displayName,
        role: row.role,
        muted: row.muted,
        leftAt: row.leftAt ? row.leftAt.toISOString() : null,
        permissionsOverridden: row.permissionsOverridden,
        canChat: row.canChat,
        canSpeak: row.canSpeak,
        canReact: row.canReact,
        canSeek: row.canSeek,
        canInvite: row.canInvite,
        canControlVideo: row.canControlVideo,
        canAddToQueue: row.canAddToQueue,
        canRemoveFromQueue: row.canRemoveFromQueue,
        canReorderQueue: row.canReorderQueue,
      };
    },
    async saveMember(member) {
      const data = {
        role: member.role,
        muted: member.muted,
        leftAt: member.leftAt ? new Date(member.leftAt) : null,
        ...(member.permissionsOverridden === undefined ? {} : { permissionsOverridden: member.permissionsOverridden }),
        ...(member.canChat === undefined ? {} : { canChat: member.canChat }),
        ...(member.canSpeak === undefined ? {} : { canSpeak: member.canSpeak }),
        ...(member.canReact === undefined ? {} : { canReact: member.canReact }),
        ...(member.canSeek === undefined ? {} : { canSeek: member.canSeek }),
        ...(member.canInvite === undefined ? {} : { canInvite: member.canInvite }),
        ...(member.canControlVideo === undefined ? {} : { canControlVideo: member.canControlVideo }),
        ...(member.canAddToQueue === undefined ? {} : { canAddToQueue: member.canAddToQueue }),
        ...(member.canRemoveFromQueue === undefined ? {} : { canRemoveFromQueue: member.canRemoveFromQueue }),
        ...(member.canReorderQueue === undefined ? {} : { canReorderQueue: member.canReorderQueue }),
      };
      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: member.roomId, userId: member.userId } },
        create: { roomId: member.roomId, userId: member.userId, ...data },
        update: data,
      });
    },
    async listMessages(roomId, limit) {
      const rows = await prisma.message.findMany({
        where: { roomId },
        include: { user: true, reactions: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.reverse().map(mapMessage);
    },
    async insertMessage(message) {
      await prisma.message.create({
        data: {
          id: message.id,
          roomId: message.roomId,
          userId: message.userId,
          body: message.body,
          replyToId: message.replyToId,
          createdAt: new Date(message.createdAt),
        },
      });
    },
    async toggleReaction({ roomId, messageId, userId, emoji }) {
      const message = await prisma.message.findFirst({
        where: { id: messageId, roomId },
        include: { reactions: true },
      });
      if (!message) {
        return null;
      }
      const existing = message.reactions.find(
        (reaction) => reaction.userId === userId && reaction.emoji === emoji,
      );
      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.reaction.create({ data: { messageId, userId, emoji } });
      }
      const fresh = await prisma.message.findUnique({
        where: { id: messageId },
        include: { user: true, reactions: true },
      });
      return fresh ? mapMessage(fresh) : null;
    },
    async listQueue(roomId) {
      const rows = await prisma.queueItem.findMany({
        where: { roomId },
        orderBy: { position: "asc" },
      });
      return rows.map(mapQueue);
    },
    async insertQueueItem(item) {
      await prisma.queueItem.create({
        data: {
          id: item.id,
          roomId: item.roomId,
          url: item.url,
          provider: item.provider,
          externalId: item.externalId,
          title: item.title,
          thumbnail: item.thumbnailUrl,
          durationMs: item.durationMs,
          position: item.position,
          addedById: item.addedById,
          played: item.played,
        },
      });
    },
    async saveQueueItem(item) {
      await prisma.queueItem.update({
        where: { id: item.id },
        data: { played: item.played, title: item.title },
      });
    },
  };
}

function mapMessage(row: {
  id: string;
  roomId: string;
  userId: string;
  body: string;
  replyToId: string | null;
  createdAt: Date;
  user: { displayName: string };
  reactions: { emoji: string; userId: string }[];
}): MessageRecord {
  return {
    id: row.id,
    roomId: row.roomId,
    userId: row.userId,
    displayName: row.user.displayName,
    body: row.body,
    replyToId: row.replyToId,
    createdAt: row.createdAt.toISOString(),
    reactions: row.reactions.map((reaction) => ({ emoji: reaction.emoji, userId: reaction.userId })),
  };
}

function mapQueue(row: {
  id: string;
  roomId: string;
  url: string;
  provider: string;
  externalId: string;
  title: string;
  thumbnail: string | null;
  durationMs: number | null;
  position: number;
  addedById: string;
  played: boolean;
}): QueueRecord {
  return {
    id: row.id,
    roomId: row.roomId,
    url: row.url,
    provider: asProvider(row.provider),
    externalId: row.externalId,
    title: row.title,
    thumbnailUrl: row.thumbnail,
    durationMs: row.durationMs,
    position: row.position,
    addedById: row.addedById,
    played: row.played,
  };
}
