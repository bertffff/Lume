import type { EmbedProvider, MemberRole, RoomCatalogItem, RoomCategory, RoomCategorySelection } from "@lume/contracts";
import type { CatalogPageInput } from "./catalog.js";

export interface RoomRecord {
  id: string;
  code: string;
  title: string;
  hostId: string;
  ownerId?: string;
  status: "open" | "live" | "ended";
  isPublic: boolean;
  category: RoomCategory;
  categorySelection: RoomCategorySelection;
  maxMembers: number;
  hideReactions?: boolean;
  slowModeSeconds?: number;
  defaultPermissions?: Record<string, boolean> | null;
  createdAt: string;
  nowPlayingId: string | null;
}

export interface MemberRecord {
  roomId: string;
  userId: string;
  displayName: string;
  role: MemberRole;
  muted: boolean;
  leftAt: string | null;
  joinedAt?: string;
  permissionsOverridden?: boolean;
  canChat?: boolean;
  canSpeak?: boolean;
  canReact?: boolean;
  canSeek?: boolean;
  canInvite?: boolean;
  canControlVideo?: boolean;
  canAddToQueue?: boolean;
  canRemoveFromQueue?: boolean;
  canReorderQueue?: boolean;
}

export interface MessageRecord {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  body: string;
  imageUrl?: string | null;
  replyToId: string | null;
  createdAt: string;
  reactions: { emoji: string; userId: string }[];
}

export interface QueueRecord {
  id: string;
  roomId: string;
  url: string;
  provider: EmbedProvider;
  externalId: string;
  title: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
  position: number;
  addedById: string;
  played: boolean;
  inferredCategory: RoomCategory;
}

export interface RoomRepository {
  /** Returns false only when the invite code collides at insert. Other failures throw. */
  insertRoom(room: RoomRecord): Promise<boolean>;
  patchRoom(
    id: string,
    patch: { status?: RoomRecord["status"] },
  ): Promise<void>;
  startPlaying(roomId: string, itemId: string): Promise<void>;
  setCategory(roomId: string, hostId: string, selection: RoomCategorySelection): Promise<void>;
  findRoomById(id: string): Promise<RoomRecord | null>;
  findRoomByCode(code: string): Promise<RoomRecord | null>;
  listPublicRooms(): Promise<RoomRecord[]>;
  listCatalog(input: CatalogPageInput): Promise<RoomCatalogItem[]>;
  listMembers(roomId: string): Promise<MemberRecord[]>;
  findMember(roomId: string, userId: string): Promise<MemberRecord | null>;
  saveMember(member: MemberRecord): Promise<void>;
  listMessages(roomId: string, limit: number): Promise<MessageRecord[]>;
  insertMessage(message: MessageRecord): Promise<void>;
  toggleReaction(input: {
    roomId: string;
    messageId: string;
    userId: string;
    emoji: string;
  }): Promise<MessageRecord | null>;
  listQueue(roomId: string): Promise<QueueRecord[]>;
  insertQueueItem(item: QueueRecord): Promise<void>;
  deleteQueueItem(roomId: string, itemId: string): Promise<void>;
  /** Rewrites positions so the given ids appear in this order; ids not listed keep their relative place after them. */
  setQueueOrder(roomId: string, orderedIds: string[]): Promise<void>;
}

export class RoomFailure extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "room_full"
      | "forbidden"
      | "muted"
      | "invalid_media"
      | "not_member"
      | "empty_queue"
      | "conflict",
  ) {
    super(code);
  }
}
