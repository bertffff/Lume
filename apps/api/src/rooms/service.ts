import {
  canActOnMember,
  canAssignRole,
  canControlPlayback,
  canToggleReaction,
  duplicateQueue,
  nextHost,
  mediaFallbackTitle,
  parseEmbedInput,
  roomOverMemberCap,
  type ChatMessage,
  type MemberRole,
  type ParsedEmbed,
  type QueueItem,
  type RoomSummary,
} from "@lume/contracts";
import type { MemberRecord, MessageRecord, QueueRecord, RoomRecord, RoomRepository } from "./types.js";
import { RoomFailure } from "./types.js";

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

export function createRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[Math.floor(random() * alphabet.length)] ?? "a";
  }
  return code;
}

export interface Actor {
  userId: string;
  displayName: string;
}

export interface RoomDetail {
  room: RoomSummary & { nowPlaying: QueueItem | null };
  self: { role: MemberRole; muted: boolean };
  members: Array<{
    userId: string;
    displayName: string;
    role: MemberRole;
    muted: boolean;
  }>;
  messages: ChatMessage[];
  queue: QueueItem[];
}

export interface ResolvedMeta {
  title: string | null;
  thumbnailUrl: string | null;
}

export type TitleResolver = (item: ParsedEmbed) => Promise<ResolvedMeta | null>;

function active(members: readonly MemberRecord[]): MemberRecord[] {
  return members.filter((member) => member.leftAt === null);
}

function toQueueItem(item: QueueRecord): QueueItem {
  return {
    id: item.id,
    roomId: item.roomId,
    url: item.url,
    provider: item.provider,
    externalId: item.externalId,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    position: item.position,
    addedById: item.addedById,
  };
}

function toMessage(message: MessageRecord): ChatMessage {
  return {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    displayName: message.displayName,
    body: message.body,
    replyToId: message.replyToId,
    createdAt: message.createdAt,
    reactions: message.reactions,
  };
}

export class RoomService {
  private readonly ids: () => string;
  private readonly now: () => Date;
  private readonly titles: TitleResolver;

  constructor(
    private readonly repo: RoomRepository,
    ids?: () => string,
    now?: () => Date,
    titles?: TitleResolver,
  ) {
    this.ids = ids ?? (() => crypto.randomUUID());
    this.now = now ?? (() => new Date());
    this.titles = titles ?? (async () => null);
  }

  async createRoom(actor: Actor, input: { title: string; isPublic?: boolean }): Promise<RoomDetail> {
    const code = await this.freshCode();
    const createdAt = this.now().toISOString();
    const room: RoomRecord = {
      id: this.ids(),
      code,
      title: input.title.trim(),
      hostId: actor.userId,
      ownerId: actor.userId,
      status: "open",
      isPublic: input.isPublic ?? false,
      createdAt,
      nowPlayingId: null,
    };
    await this.repo.insertRoom(room);
    await this.repo.saveMember({
      roomId: room.id,
      userId: actor.userId,
      displayName: actor.displayName,
      role: "host",
      muted: false,
      leftAt: null,
    });
    return this.detailFor(actor.userId, room.id);
  }

  async listPublic(): Promise<RoomSummary[]> {
    const rooms = await this.repo.listPublicRooms();
    const summaries: RoomSummary[] = [];
    for (const room of rooms) {
      const members = active(await this.repo.listMembers(room.id));
      summaries.push(this.summarize(room, members.length));
    }
    return summaries;
  }

  async joinByCode(actor: Actor, code: string): Promise<RoomDetail> {
    const room = await this.repo.findRoomByCode(code.trim().toLowerCase());
    if (!room || room.status === "ended") {
      throw new RoomFailure("not_found");
    }
    const members = await this.repo.listMembers(room.id);
    const existing = members.find((member) => member.userId === actor.userId) ?? null;
    if (existing?.leftAt === null) {
      return this.detailFor(actor.userId, room.id);
    }
    if (roomOverMemberCap(active(members).length)) {
      throw new RoomFailure("room_full");
    }
    const reclaim = room.ownerId === actor.userId;
    if (reclaim) {
      const currentHost = members.find((item) => item.role === "host" && item.leftAt === null && item.userId !== actor.userId);
      if (currentHost) {
        await this.repo.saveMember({ ...currentHost, role: "viewer" });
      }
    }
    await this.repo.saveMember({
      roomId: room.id,
      userId: actor.userId,
      displayName: actor.displayName,
      role: reclaim ? "host" : (existing?.role === "host" ? "viewer" : existing?.role ?? "viewer"),
      muted: existing?.muted ?? false,
      leftAt: null,
    });
    if (!existing || existing.leftAt !== null) {
      await this.repo.insertMessage({
        id: this.ids(),
        roomId: room.id,
        userId: actor.userId,
        displayName: actor.displayName,
        body: reclaim ? `${actor.displayName} вернулся и забрал хост` : `${actor.displayName} присоединился к комнате`,
        replyToId: null,
        createdAt: this.now().toISOString(),
        reactions: [],
      });
    }
    return this.detailFor(actor.userId, room.id);
  }

  async leave(actor: Actor, roomId: string): Promise<{ hostLeft: boolean }> {
    const { member } = await this.requireActive(roomId, actor.userId);
    const members = await this.repo.listMembers(roomId);
    await this.repo.saveMember({ ...member, leftAt: this.now().toISOString() });
    await this.repo.insertMessage({
      id: this.ids(),
      roomId,
      userId: actor.userId,
      displayName: actor.displayName,
      body: `${actor.displayName} покинул комнату`,
      replyToId: null,
      createdAt: this.now().toISOString(),
      reactions: [],
    });
    if (member.role !== "host") {
      return { hostLeft: false };
    }
    const rest = members.filter((item) => item.userId !== actor.userId && item.leftAt === null);
    const successorId = nextHost(
      rest.map((item) => ({
        userId: item.userId,
        role: item.role,
        joinedAtMs: item.joinedAt ? Date.parse(item.joinedAt) : 0,
      })),
      actor.userId,
    );
    const successor = rest.find((item) => item.userId === successorId);
    if (successor) {
      await this.repo.saveMember({ ...successor, role: "host" });
      await this.repo.insertMessage({
        id: this.ids(),
        roomId,
        userId: successor.userId,
        displayName: successor.displayName,
        body: `${successor.displayName} стал хостом`,
        replyToId: null,
        createdAt: this.now().toISOString(),
        reactions: [],
      });
    }
    return { hostLeft: true };
  }

  async kick(actor: Actor, roomId: string, targetUserId: string): Promise<RoomDetail> {
    const { member } = await this.requireActive(roomId, actor.userId);
    const target = await this.requireTarget(roomId, targetUserId);
    if (!canActOnMember(member.role, target.role)) {
      throw new RoomFailure("forbidden");
    }
    await this.repo.saveMember({ ...target, leftAt: this.now().toISOString() });
    return this.detailFor(actor.userId, roomId);
  }

  async mute(actor: Actor, roomId: string, targetUserId: string, muted: boolean): Promise<RoomDetail> {
    const { member } = await this.requireActive(roomId, actor.userId);
    const target = await this.requireTarget(roomId, targetUserId);
    if (!canActOnMember(member.role, target.role)) {
      throw new RoomFailure("forbidden");
    }
    await this.repo.saveMember({ ...target, muted });
    return this.detailFor(actor.userId, roomId);
  }

  async transferHost(actor: Actor, roomId: string, targetUserId: string): Promise<RoomDetail> {
    const { member } = await this.requireActive(roomId, actor.userId);
    if (member.role !== "host") {
      throw new RoomFailure("forbidden");
    }
    const target = await this.requireTarget(roomId, targetUserId);
    await this.repo.saveMember({ ...member, role: "viewer" });
    await this.repo.saveMember({ ...target, role: "host" });
    await this.repo.insertMessage({
      id: this.ids(),
      roomId,
      userId: actor.userId,
      displayName: actor.displayName,
      body: `${target.displayName} теперь хост`,
      replyToId: null,
      createdAt: this.now().toISOString(),
      reactions: [],
    });
    return this.detailFor(actor.userId, roomId);
  }

  async setRole(
    actor: Actor,
    roomId: string,
    targetUserId: string,
    role: "mod" | "viewer",
  ): Promise<RoomDetail> {
    const { member } = await this.requireActive(roomId, actor.userId);
    if (!canAssignRole(member.role)) {
      throw new RoomFailure("forbidden");
    }
    const target = await this.requireTarget(roomId, targetUserId);
    if (target.role === "host") {
      throw new RoomFailure("forbidden");
    }
    await this.repo.saveMember({ ...target, role });
    return this.detailFor(actor.userId, roomId);
  }

  async sendMessage(
    actor: Actor,
    roomId: string,
    body: string,
    replyToId?: string | null,
  ): Promise<ChatMessage> {
    const { member } = await this.requireActive(roomId, actor.userId);
    if (member.muted) {
      throw new RoomFailure("muted");
    }
    if (replyToId) {
      const existing = await this.repo.listMessages(roomId, 200);
      if (!existing.some((message) => message.id === replyToId)) {
        throw new RoomFailure("not_found");
      }
    }
    const message: MessageRecord = {
      id: this.ids(),
      roomId,
      userId: actor.userId,
      displayName: member.displayName,
      body: body.trim(),
      replyToId: replyToId ?? null,
      createdAt: this.now().toISOString(),
      reactions: [],
    };
    await this.repo.insertMessage(message);
    return toMessage(message);
  }

  async react(actor: Actor, roomId: string, messageId: string, emoji: string): Promise<ChatMessage> {
    await this.requireActive(roomId, actor.userId);
    const existing = (await this.repo.listMessages(roomId, 200)).find((item) => item.id === messageId);
    if (!existing) {
      throw new RoomFailure("not_found");
    }
    const mine = existing.reactions.filter((reaction) => reaction.userId === actor.userId).map((reaction) => reaction.emoji);
    if (!canToggleReaction(mine, emoji)) {
      throw new RoomFailure("conflict");
    }
    const message = await this.repo.toggleReaction({
      roomId,
      messageId,
      userId: actor.userId,
      emoji,
    });
    if (!message) {
      throw new RoomFailure("not_found");
    }
    return toMessage(message);
  }

  async addQueueItem(actor: Actor, roomId: string, url: string): Promise<RoomDetail> {
    const { member } = await this.requireActive(roomId, actor.userId);
    if (member.muted) {
      throw new RoomFailure("muted");
    }
    const parsed = parseEmbedInput(url);
    if (!parsed) {
      throw new RoomFailure("invalid_media");
    }
    const meta = await this.titles(parsed);
    const title = meta?.title?.trim() || mediaFallbackTitle(parsed.url);
    const queue = await this.repo.listQueue(roomId);
    if (duplicateQueue(queue.map((item) => item.url), parsed.url)) {
      throw new RoomFailure("conflict");
    }
    const last = queue[queue.length - 1];
    await this.repo.insertQueueItem({
      id: this.ids(),
      roomId,
      url: parsed.url,
      provider: parsed.provider,
      externalId: parsed.externalId,
      title,
      thumbnailUrl: meta?.thumbnailUrl ?? null,
      position: (last?.position ?? 0) + 1,
      addedById: actor.userId,
      played: false,
    });
    return this.detailFor(actor.userId, roomId);
  }

  async playNext(actor: Actor, roomId: string): Promise<RoomDetail> {
    const { room, member } = await this.requireActive(roomId, actor.userId);
    if (!canControlPlayback(member.role)) {
      throw new RoomFailure("forbidden");
    }
    const queue = await this.repo.listQueue(roomId);
    const current = queue.find((item) => item.id === room.nowPlayingId) ?? null;
    const currentPosition = current?.position ?? -1;
    const next = queue.find((item) => item.position > currentPosition);
    if (!next) {
      throw new RoomFailure("empty_queue");
    }
    if (current) {
      await this.repo.saveQueueItem({ ...current, played: true });
    }
    await this.repo.saveQueueItem({ ...next, played: true });
    await this.repo.patchRoom(room.id, { status: "live", nowPlayingId: next.id });
    return this.detailFor(actor.userId, roomId);
  }

  async detailFor(userId: string, roomId: string): Promise<RoomDetail> {
    const room = await this.repo.findRoomById(roomId);
    if (!room) {
      throw new RoomFailure("not_found");
    }
    const members = await this.repo.listMembers(roomId);
    const self = members.find((member) => member.userId === userId && member.leftAt === null);
    if (!self) {
      throw new RoomFailure("not_member");
    }
    const present = active(members);
    const queue = await this.repo.listQueue(roomId);
    const messages = await this.repo.listMessages(roomId, 50);
    const nowPlaying = queue.find((item) => item.id === room.nowPlayingId) ?? null;
    return {
      room: { ...this.summarize(room, present.length), nowPlaying: nowPlaying ? toQueueItem(nowPlaying) : null },
      self: { role: self.role, muted: self.muted },
      members: present.map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        role: member.role,
        muted: member.muted,
      })),
      messages: messages.map(toMessage),
      queue: queue.map(toQueueItem),
    };
  }

  private summarize(room: RoomRecord, memberCount: number): RoomSummary {
    return {
      id: room.id,
      code: room.code,
      title: room.title,
      hostId: room.hostId,
      status: room.status,
      isPublic: room.isPublic,
      memberCount,
      createdAt: room.createdAt,
    };
  }

  private async freshCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = createRoomCode();
      const existing = await this.repo.findRoomByCode(code);
      if (!existing) {
        return code;
      }
    }
    throw new RoomFailure("conflict");
  }

  private async requireActive(roomId: string, userId: string): Promise<{ room: RoomRecord; member: MemberRecord }> {
    const room = await this.repo.findRoomById(roomId);
    if (!room) {
      throw new RoomFailure("not_found");
    }
    const member = await this.repo.findMember(roomId, userId);
    if (!member || member.leftAt !== null) {
      throw new RoomFailure("not_member");
    }
    return { room, member };
  }

  private async requireTarget(roomId: string, userId: string): Promise<MemberRecord> {
    const member = await this.repo.findMember(roomId, userId);
    if (!member || member.leftAt !== null) {
      throw new RoomFailure("not_found");
    }
    return member;
  }
}

