import { z } from "zod";
import { chatReactSchema, chatSendSchema } from "./chat.js";
import { queueAddSchema, queueItemActionSchema, queueMoveSchema, queueNextSchema } from "./queue.js";
import { memberRoleSchema } from "./roles.js";
import { voiceDisconnectSchema, voiceJoinSchema, voiceMuteSchema, voiceStateSchema } from "./voice.js";

export const roomJoinSchema = z.object({
  roomId: z.string().min(1).max(80),
});

export const roomLeaveSchema = z.object({
  roomId: z.string().min(1).max(80),
});

export const playbackCommandSchema = z.object({
  roomId: z.string().min(1),
  clientTimeMs: z.number().int().nonnegative(),
  positionMs: z.number().int().nonnegative().optional(),
});

export const playbackViewerSchema = z.object({
  roomId: z.string().min(1),
  phase: z.enum(["buffering", "ready"]),
});

export const playbackSeekSchema = playbackCommandSchema.extend({
  positionMs: z.number().int().nonnegative(),
});

export const playbackSyncRequestSchema = z.object({
  roomId: z.string().min(1),
});

export const clockPingSchema = z.object({
  roomId: z.string().min(1),
  t0: z.number().finite(),
});

export const presenceMemberSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
  role: memberRoleSchema,
  muted: z.boolean(),
  joinedAtMs: z.number().int().nonnegative(),
});

export const playbackSnapshotSchema = z.object({
  roomId: z.string().min(1),
  status: z.enum(["playing", "paused"]),
  positionMs: z.number().int().nonnegative(),
  anchorPositionMs: z.number().int().nonnegative(),
  anchorServerTimeMs: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  updatedBy: z.string().min(1),
  serverTimeMs: z.number().int().nonnegative(),
});

export const roomErrorSchema = z.object({
  code: z.enum([
    "invalid_payload",
    "not_host",
    "forbidden",
    "muted",
    "redis_unavailable",
    "not_owner",
    "version_conflict",
    "not_member",
    "room_full",
    "persistence_unavailable",
    "invalid_media",
    "empty_queue",
    "unauthorized",
    "not_found",
    "conflict",
  ]),
  message: z.string().min(1),
  ownerIndex: z.number().int().nonnegative().optional(),
});

export const clockPongSchema = z.object({
  roomId: z.string().min(1),
  t0: z.number().finite(),
  t1: z.number().finite(),
  t2: z.number().finite(),
});

export const modKickSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
});

export const modMuteSchema = modKickSchema.extend({
  muted: z.boolean(),
});

export const modRoleSchema = modKickSchema.extend({
  role: z.enum(["mod", "viewer"]),
});

export const clientEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("room:join"), payload: roomJoinSchema }),
  z.object({ event: z.literal("room:leave"), payload: roomLeaveSchema }),
  z.object({ event: z.literal("playback:play"), payload: playbackCommandSchema }),
  z.object({ event: z.literal("playback:pause"), payload: playbackCommandSchema }),
  z.object({ event: z.literal("playback:seek"), payload: playbackSeekSchema }),
  z.object({ event: z.literal("playback:sync"), payload: playbackSyncRequestSchema }),
  z.object({ event: z.literal("clock:ping"), payload: clockPingSchema }),
  z.object({ event: z.literal("playback:viewer"), payload: playbackViewerSchema }),
  z.object({ event: z.literal("voice:join"), payload: voiceJoinSchema }),
  z.object({ event: z.literal("voice:leave"), payload: voiceJoinSchema }),
  z.object({ event: z.literal("voice:state"), payload: voiceStateSchema }),
  z.object({ event: z.literal("voice:mute"), payload: voiceMuteSchema }),
  z.object({ event: z.literal("voice:disconnect"), payload: voiceDisconnectSchema }),
  z.object({ event: z.literal("chat:send"), payload: chatSendSchema }),
  z.object({ event: z.literal("chat:react"), payload: chatReactSchema }),
  z.object({ event: z.literal("queue:add"), payload: queueAddSchema }),
  z.object({ event: z.literal("queue:next"), payload: queueNextSchema }),
  z.object({ event: z.literal("queue:remove"), payload: queueItemActionSchema }),
  z.object({ event: z.literal("queue:move"), payload: queueMoveSchema }),
  z.object({ event: z.literal("queue:play"), payload: queueItemActionSchema }),
  z.object({ event: z.literal("mod:kick"), payload: modKickSchema }),
  z.object({ event: z.literal("mod:mute"), payload: modMuteSchema }),
  z.object({ event: z.literal("mod:role"), payload: modRoleSchema }),
]);

export type ClientEvent = z.infer<typeof clientEventSchema>;
export type RoomJoin = z.infer<typeof roomJoinSchema>;
export type PlaybackCommand = z.infer<typeof playbackCommandSchema>;
export type PlaybackSeek = z.infer<typeof playbackSeekSchema>;
export type PlaybackSnapshot = z.infer<typeof playbackSnapshotSchema>;
export type PresenceMember = z.infer<typeof presenceMemberSchema>;
export type RoomError = z.infer<typeof roomErrorSchema>;
export type ClockPing = z.infer<typeof clockPingSchema>;
export type ClockPong = z.infer<typeof clockPongSchema>;

export function toPlaybackSnapshot(
  roomId: string,
  anchor: {
    status: "playing" | "paused";
    anchorPositionMs: number;
    anchorServerTimeMs: number;
    version: number;
    updatedBy: string;
  },
  positionMs: number,
  serverTimeMs: number,
): PlaybackSnapshot {
  return playbackSnapshotSchema.parse({
    roomId,
    status: anchor.status,
    positionMs,
    anchorPositionMs: anchor.anchorPositionMs,
    anchorServerTimeMs: anchor.anchorServerTimeMs,
    version: anchor.version,
    updatedBy: anchor.updatedBy,
    serverTimeMs,
  });
}
