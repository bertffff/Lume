import { randomInt } from "node:crypto";
import {
  canActOnMember,
  canAssignRole,
  canControlPlayback,
  canToggleReaction,
  duplicateQueue,
  memberFlagsFromDefaults,
  nextHost,
  mediaFallbackTitle,
  parseEmbedInput,
  parseRoomCode,
  roomOverMemberCap,
  roomPresetById,
  FREE_ROOM_MEMBER_CAP,
  ROOM_CODE_ALPHABET,
  type RoomPresetId,
  type ChatMessage,
  type MemberPermissionFlags,
  type MemberRole,
  type ParsedEmbed,
  type QueueItem,
  type RoomCategory,
  type RoomCategorySelection,
  type RoomSummary,
  type ViewerDefaultFlags,
} from "@lume/contracts";
import type { MemberRecord, MessageRecord, QueueRecord, RoomRecord, RoomRepository } from "./types.js";
import { RoomFailure } from "./types.js";
import { classifyRoomCategory, mediaCategorySource, resolveEffectiveCategory, type CategoryMetadata } from "./category.js";
import { catalogFetchSize, catalogResponse, type CatalogPageInput } from "./catalog.js";

const MAX_ROOM_CODE_ATTEMPTS = 8;

export function createRoomCode(): string {
  return Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length))).join("");
}

export interface Actor {
  userId: string;
  displayName: string;
}

export interface RoomDetail {
  room: RoomSummary & { nowPlaying: QueueItem | null; category: RoomCategory; categorySelection: RoomCategorySelection };
  self: { role: MemberRole; muted: boolean; permissions: MemberPermissionFlags };
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
  durationMs: number | null;
  category?: RoomCategory;
  channel?: string;
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
    durationMs: item.durationMs,
    position: item.position,
    addedById: item.addedById,
    played: item.played,
  };
}

function toMessage(message: MessageRecord): ChatMessage {
  return {
    id: message.id,
    roomId: message.roomId,
    userId: message.userId,
    displayName: message.displayName,
    body: message.body,
    imageUrl: message.imageUrl ?? null,
    replyToId: message.replyToId,
    createdAt: message.createdAt,
    reactions: message.reactions,
  };
}

/** Falls back to the schema defaults when an older row has no stored flags. */
function memberPermissions(member: MemberRecord): MemberPermissionFlags {
  return {
    canChat: member.canChat ?? true,
    canSpeak: member.canSpeak ?? true,
    canReact: member.canReact ?? true,
    canSeek: member.canSeek ?? false,
    canInvite: member.canInvite ?? true,
    canControlVideo: member.canControlVideo ?? false,
    canAddToQueue: member.canAddToQueue ?? true,
    canRemoveFromQueue: member.canRemoveFromQueue ?? false,
    canReorderQueue: member.canReorderQueue ?? false,
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
    private readonly generateCode: () => string = createRoomCode,
  ) {
    this.ids = ids ?? (() => crypto.randomUUID());
    this.now = now ?? (() => new Date());
    this.titles = titles ?? (async () => null);
  }

  async createRoom(actor: Actor, input: { title: string; isPublic?: boolean; preset?: RoomPresetId; categorySelection?: RoomCategorySelection; defaults?: ViewerDefaultFlags }): Promise<RoomDetail> {
    const createdAt = this.now().toISOString();
    const preset = input.preset ? roomPresetById(input.preset) : null;
    const room = {
      id: this.ids(),
      title: input.title.trim(),
      hostId: actor.userId,
      ownerId: actor.userId,
      status: "open",
      isPublic: (input.defaults ? input.isPublic : preset?.isPublic) ?? preset?.isPublic ?? input.isPublic ?? false,
      categorySelection: input.categorySelection ?? "auto",
      category: resolveEffectiveCategory(input.categorySelection),
      maxMembers: preset?.maxMembers ?? FREE_ROOM_MEMBER_CAP,
      hideReactions: preset?.hideReactions ?? false,
      slowModeSeconds: preset?.slowModeSeconds ?? 0,
      defaultPermissions: input.defaults ? { ...input.defaults } : preset ? { ...preset.defaults } : null,
      createdAt,
      nowPlayingId: null,
    } satisfies Omit<RoomRecord, "code">;
    await this.insertWithFreshCode(room);
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
      // An abandoned room with nobody inside must not stay in "Open rooms" forever.
      if (members.length === 0) continue;
      summaries.push(this.summarize(room, members.length));
    }
    return summaries;
  }

  async catalog(input: Omit<CatalogPageInput, "take" | "now">) {
    return catalogResponse(await this.repo.listCatalog({ ...input, take: catalogFetchSize, now: this.now() }));
  }

  async setCategory(actor: Actor, roomId: string, selection: RoomCategorySelection): Promise<RoomDetail> {
    const { member } = await this.requireActive(roomId, actor.userId);
    if (member.role !== "host") throw new RoomFailure("forbidden");
    await this.repo.setCategory(roomId, actor.userId, selection);
    return this.detailFor(actor.userId, roomId);
  }

  async joinByCode(actor: Actor, code: string): Promise<RoomDetail> {
    const canonical = parseRoomCode(code);
    if (!canonical) throw new RoomFailure("not_found");
    const room = await this.repo.findRoomByCode(canonical);
    if (!room || room.status === "ended") {
      throw new RoomFailure("not_found");
    }
    const members = await this.repo.listMembers(room.id);
    const existing = members.find((member) => member.userId === actor.userId) ?? null;
    if (existing?.leftAt === null) {
      return this.detailFor(actor.userId, room.id);
    }
    if (roomOverMemberCap(active(members).length, room.maxMembers)) {
      throw new RoomFailure("room_full");
    }
    const reclaim = room.ownerId === actor.userId;
    if (reclaim) {
      const currentHost = members.find((item) => item.role === "host" && item.leftAt === null && item.userId !== actor.userId);
      if (currentHost) {
        await this.repo.saveMember({ ...currentHost, role: "viewer" });
      }
    }
    const projected = existing?.permissionsOverridden ? {} : memberFlagsFromDefaults(room.defaultPermissions);
    await this.repo.saveMember({
      roomId: room.id,
      userId: actor.userId,
      displayName: actor.displayName,
      role: reclaim ? "host" : (existing?.role === "host" ? "viewer" : existing?.role ?? "viewer"),
      muted: existing?.muted ?? false,
      leftAt: null,
      permissionsOverridden: existing?.permissionsOverridden ?? false,
      ...projected,
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
    imageUrl?: string | null,
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
      imageUrl: imageUrl ?? null,
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

  async addQueueItem(actor: Actor, roomId: string, url: string, titleHint?: string): Promise<RoomDetail> {
    const { member } = await this.requireActive(roomId, actor.userId);
    if (member.muted) {
      throw new RoomFailure("muted");
    }
    const parsed = parseEmbedInput(url);
    if (!parsed) {
      throw new RoomFailure("invalid_media");
    }
    const queue = await this.repo.listQueue(roomId);
    if (duplicateQueue(queue.filter((item) => !item.played).map((item) => item.url), parsed.url)) {
      throw new RoomFailure("conflict");
    }
    await this.enqueue(actor, roomId, parsed, queue, titleHint);
    return this.detailFor(actor.userId, roomId);
  }

  async removeQueueItem(actor: Actor, roomId: string, itemId: string): Promise<RoomDetail> {
    const { room, member } = await this.requireActive(roomId, actor.userId);
    const item = (await this.repo.listQueue(roomId)).find((entry) => entry.id === itemId);
    if (!item) throw new RoomFailure("not_found");
    if (item.id === room.nowPlayingId) throw new RoomFailure("conflict");
    const allowed = canControlPlayback(member.role) || member.canRemoveFromQueue === true || item.addedById === actor.userId;
    if (!allowed) throw new RoomFailure("forbidden");
    await this.repo.deleteQueueItem(roomId, itemId);
    return this.detailFor(actor.userId, roomId);
  }

  async moveQueueItem(actor: Actor, roomId: string, itemId: string, direction: "up" | "down"): Promise<RoomDetail> {
    const { room, member } = await this.requireActive(roomId, actor.userId);
    if (!canControlPlayback(member.role) && member.canReorderQueue !== true) throw new RoomFailure("forbidden");
    const upcoming = (await this.repo.listQueue(roomId)).filter((entry) => !entry.played && entry.id !== room.nowPlayingId);
    const index = upcoming.findIndex((entry) => entry.id === itemId);
    if (index < 0) throw new RoomFailure("not_found");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < upcoming.length) {
      const ids = upcoming.map((entry) => entry.id);
      [ids[index], ids[target]] = [ids[target]!, ids[index]!];
      await this.repo.setQueueOrder(roomId, ids);
    }
    return this.detailFor(actor.userId, roomId);
  }

  async playQueueItem(actor: Actor, roomId: string, itemId: string): Promise<RoomDetail> {
    const { room, member } = await this.requireActive(roomId, actor.userId);
    if (!canControlPlayback(member.role)) throw new RoomFailure("forbidden");
    const item = (await this.repo.listQueue(roomId)).find((entry) => entry.id === itemId);
    if (!item || item.id === room.nowPlayingId) throw new RoomFailure("not_found");
    await this.repo.startPlaying(roomId, item.id);
    return this.detailFor(actor.userId, roomId);
  }

  async replacePlaying(actor: Actor, roomId: string, url: string, restoredCategory?: RoomCategory): Promise<RoomDetail> {
    const { room, member } = await this.requireActive(roomId, actor.userId);
    if (!canControlPlayback(member.role) || member.muted) throw new RoomFailure("forbidden");
    const parsed = parseEmbedInput(url);
    if (!parsed) throw new RoomFailure("invalid_media");
    const queue = await this.repo.listQueue(roomId);
    const item = queue.find((entry) => entry.url === parsed.url && (!entry.played || entry.id === room.nowPlayingId));
    const id = item?.id ?? await this.enqueue(actor, roomId, parsed, queue, undefined, restoredCategory);
    await this.repo.startPlaying(roomId, id);
    return this.detailFor(actor.userId, roomId);
  }

  private async enqueue(actor: Actor, roomId: string, parsed: ParsedEmbed, queue: QueueRecord[], titleHint?: string, restoredCategory?: RoomCategory): Promise<string> {
    const meta = await this.titles(parsed);
    const evidence: CategoryMetadata = { ...meta, source: mediaCategorySource(parsed.url, parsed.provider) };
    const title = titleHint?.trim() || meta?.title?.trim() || mediaFallbackTitle(parsed.url);
    const last = queue[queue.length - 1];
    const id = this.ids();
    await this.repo.insertQueueItem({
      id,
      roomId,
      url: parsed.url,
      provider: parsed.provider,
      externalId: parsed.externalId,
      title,
      thumbnailUrl: meta?.thumbnailUrl ?? null,
      durationMs: meta?.durationMs ?? null,
      position: (last?.position ?? 0) + 1,
      addedById: actor.userId,
      played: false,
      inferredCategory: restoredCategory ?? classifyRoomCategory(evidence),
    });
    return id;
  }

  async playNext(actor: Actor, roomId: string): Promise<RoomDetail> {
    const { room, member } = await this.requireActive(roomId, actor.userId);
    if (!canControlPlayback(member.role)) {
      throw new RoomFailure("forbidden");
    }
    const queue = await this.repo.listQueue(roomId);
    const next = queue.find((item) => !item.played && item.id !== room.nowPlayingId);
    if (!next) {
      throw new RoomFailure("empty_queue");
    }
    await this.repo.startPlaying(room.id, next.id);
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
      room: { ...this.summarize(room, present.length), category: room.category, categorySelection: room.categorySelection,
        nowPlaying: nowPlaying ? toQueueItem(nowPlaying) : null },
      self: { role: self.role, muted: self.muted, permissions: memberPermissions(self) },
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

  private async insertWithFreshCode(room: Omit<RoomRecord, "code">): Promise<void> {
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      if (await this.repo.insertRoom({ ...room, code: this.generateCode() })) return;
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
