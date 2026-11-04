import { z } from "zod";

export const roomJoinSchema = z.object({
  roomId: z.string().min(1).max(80),
  userId: z.string().min(1),
  displayName: z.string().min(1).max(80),
});

export const roomLeaveSchema = z.object({
  roomId: z.string().min(1).max(80),
  userId: z.string().min(1),
});

export const playbackCommandSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
  clientTimeMs: z.number().int().nonnegative(),
});

export const playbackSeekSchema = playbackCommandSchema.extend({
  positionMs: z.number().int().nonnegative(),
});

export const playbackSyncRequestSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
});

export const clockPingSchema = z.object({
  roomId: z.string().min(1),
  t0: z.number().finite(),
});

export const presenceMemberSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
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
    "redis_unavailable",
    "not_owner",
    "version_conflict",
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

export const clientEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("room:join"), payload: roomJoinSchema }),
  z.object({ event: z.literal("room:leave"), payload: roomLeaveSchema }),
  z.object({ event: z.literal("playback:play"), payload: playbackCommandSchema }),
  z.object({ event: z.literal("playback:pause"), payload: playbackCommandSchema }),
  z.object({ event: z.literal("playback:seek"), payload: playbackSeekSchema }),
  z.object({ event: z.literal("playback:sync"), payload: playbackSyncRequestSchema }),
  z.object({ event: z.literal("clock:ping"), payload: clockPingSchema }),
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
