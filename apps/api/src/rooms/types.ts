import type { EmbedProvider, MemberRole } from "@lume/contracts";

export interface RoomRecord {
  id: string;
  code: string;
  title: string;
  hostId: string;
  ownerId?: string;
  status: "open" | "live" | "ended";
  isPublic: boolean;
  maxMembers: number;
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
}

export interface RoomRepository {
  insertRoom(room: RoomRecord): Promise<void>;
  patchRoom(
    id: string,
    patch: { status?: RoomRecord["status"]; nowPlayingId?: string | null },
  ): Promise<void>;
  findRoomById(id: string): Promise<RoomRecord | null>;
  findRoomByCode(code: string): Promise<RoomRecord | null>;
  listPublicRooms(): Promise<RoomRecord[]>;
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
  saveQueueItem(item: QueueRecord): Promise<void>;
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
