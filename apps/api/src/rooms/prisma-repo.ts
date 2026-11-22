import { defaultRoomLayout, embedProviderSchema, type EmbedProvider } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import { RoomFailure, type MessageRecord, type QueueRecord, type RoomRecord, type RoomRepository } from "./types.js";
import { prismaCatalog } from "./prisma-catalog.js";
import { lockCategoryRoom } from "./prisma-category.js";

function isSlugCollision(error: unknown): boolean {
  const failure = error as { code?: unknown; meta?: { target?: unknown } } | null;
  const target = failure?.meta?.target;
  return failure?.code === "P2002" && Array.isArray(target) && target.length === 1 && target[0] === "slug";
}

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
  category: RoomRecord["category"];
  categorySelection: RoomRecord["categorySelection"];
  maxMembers: number;
  hideReactions: boolean;
  slowModeSeconds: number;
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
    category: room.category,
    categorySelection: room.categorySelection,
    maxMembers: room.maxMembers,
    hideReactions: room.hideReactions,
    slowModeSeconds: room.slowModeSeconds,
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
      try {
        await prisma.room.create({
          data: {
            id: room.id,
            slug: room.code,
            title: room.title,
            hostId: room.hostId,
            ownerId: room.hostId,
            status: room.status,
            isPublic: room.isPublic,
            category: room.category,
            categorySelection: room.categorySelection,
            maxMembers: room.maxMembers,
            hideReactions: room.hideReactions ?? false,
            slowModeSeconds: room.slowModeSeconds ?? 0,
            ...(room.defaultPermissions ? { defaultPermissions: room.defaultPermissions } : {}),
            layout: defaultRoomLayout,
            videoAspect: defaultRoomLayout.videoAspect,
            createdAt: new Date(room.createdAt),
          },
        });
        return true;
      } catch (error) {
        if (isSlugCollision(error)) return false;
        throw error;
      }
    },
    async patchRoom(id, patch) {
      await prisma.room.update({
        where: { id },
        data: patch,
      });
    },
    async startPlaying(roomId, itemId) {
      await prisma.$transaction(async (tx) => {
        await lockCategoryRoom(tx, roomId);
        const room = await tx.room.findUniqueOrThrow({ where: { id: roomId }, select: { categorySelection: true } });
        const item = await tx.queueItem.update({ where: { id: itemId, roomId }, data: { played: true } });
        await tx.room.update({ where: { id: roomId }, data: {
          status: "live",
          nowPlayingId: item.id,
          category: room.categorySelection === "auto" ? item.inferredCategory : room.categorySelection,
        } });
      });
    },
    async setCategory(roomId, hostId, selection) {
      await prisma.$transaction(async (tx) => {
        await lockCategoryRoom(tx, roomId);
        const room = await tx.room.findUnique({ where: { id: roomId }, include: { nowPlaying: true } });
        if (!room) throw new RoomFailure("not_found");
        const member = await tx.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: hostId } } });
        if (!member || member.leftAt || member.role !== "host") throw new RoomFailure("forbidden");
        await tx.room.update({ where: { id: roomId }, data: {
          categorySelection: selection,
          category: selection === "auto" ? room.nowPlaying?.inferredCategory ?? "other" : selection,
        } });
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
    listCatalog: (input) => prismaCatalog(prisma, input),
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
        avatarUrl: row.user.avatarUrl,
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
        avatarUrl: row.user.avatarUrl,
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
          type: message.imageUrl ? "image" : "text",
          imageUrl: message.imageUrl ?? null,
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
          inferredCategory: item.inferredCategory,
        },
      });
    },
    async deleteQueueItem(roomId, itemId) {
      await prisma.queueItem.deleteMany({ where: { id: itemId, roomId } });
    },
    async setQueueOrder(roomId, orderedIds) {
      await prisma.$transaction(orderedIds.map((id, index) => prisma.queueItem.updateMany({ where: { id, roomId }, data: { position: index } })));
    },
  };
}

function mapMessage(row: {
  id: string;
  roomId: string;
  userId: string;
  body: string;
  imageUrl: string | null;
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
    imageUrl: row.imageUrl,
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
  inferredCategory: QueueRecord["inferredCategory"];
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
    inferredCategory: row.inferredCategory,
  };
}
