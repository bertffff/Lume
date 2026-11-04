import {
  clockPingSchema,
  foreignOwnerIndex,
  initialPlayback,
  playbackCommandSchema,
  playbackSeekSchema,
  playbackSyncRequestSchema,
  roomJoinSchema,
  roomLeaveSchema,
  type RoomError,
} from "@lume/contracts";
import type { Server, Socket } from "socket.io";
import type { RealtimeEnv } from "../env.js";
import type { RedisPair } from "../redis.js";
import { commitPlayback, readPlayback, snapshotFor } from "../rooms/playback.js";
import { joinRoom, leaveRoom, readHost } from "../rooms/presence.js";

interface Binding {
  roomId: string;
  userId: string;
}

/**
 * Socket id → membership. This map is connection bookkeeping on one process.
 * Room membership, host, and playback live in Redis, never here.
 */
const bindings = new Map<string, Binding>();

function fail(socket: Socket, error: RoomError): void {
  socket.emit("room:error", error);
}

export function registerSocketHandlers(
  io: Server,
  env: RealtimeEnv,
  redis: RedisPair | null,
): void {
  io.on("connection", (socket) => {
    socket.on("room:join", async (payload: unknown) => {
      const parsed = roomJoinSchema.safeParse(payload);
      if (!parsed.success) {
        fail(socket, { code: "invalid_payload", message: "room:join" });
        return;
      }
      if (!redis) {
        fail(socket, { code: "redis_unavailable", message: "room:join" });
        return;
      }
      const ownerIndex = env.REALTIME_ENFORCE_ROOM_OWNER
        ? foreignOwnerIndex(parsed.data.roomId, env.REALTIME_REPLICA_INDEX, env.REALTIME_REPLICA_COUNT)
        : null;
      if (ownerIndex !== null) {
        fail(socket, {
          code: "not_owner",
          message: "room writes are pinned to another replica",
          ownerIndex,
        });
        return;
      }
      const joined = await joinRoom(redis.pub, parsed.data.roomId, {
        userId: parsed.data.userId,
        displayName: parsed.data.displayName,
        joinedAtMs: Date.now(),
      });
      await socket.join(parsed.data.roomId);
      bindings.set(socket.id, { roomId: parsed.data.roomId, userId: parsed.data.userId });
      const anchor =
        (await readPlayback(redis.pub, parsed.data.roomId)) ??
        initialPlayback(joined.hostId, Date.now());
      socket.emit("room:state", {
        roomId: parsed.data.roomId,
        hostId: joined.hostId,
        members: joined.members,
        playback: snapshotFor(parsed.data.roomId, anchor, Date.now()),
        ownerIndex: env.REALTIME_REPLICA_INDEX,
      });
      io.to(parsed.data.roomId).emit("room:presence", {
        roomId: parsed.data.roomId,
        members: joined.members,
      });
    });

    socket.on("room:leave", async (payload: unknown) => {
      const parsed = roomLeaveSchema.safeParse(payload);
      if (!parsed.success || !redis) {
        return;
      }
      await depart(io, redis, socket, parsed.data.roomId, parsed.data.userId);
    });

    socket.on("disconnect", async () => {
      const binding = bindings.get(socket.id);
      if (!binding || !redis) {
        bindings.delete(socket.id);
        return;
      }
      await depart(io, redis, socket, binding.roomId, binding.userId);
    });

    socket.on("playback:play", (payload: unknown) => {
      void mutate(io, redis, socket, payload, { type: "play" });
    });
    socket.on("playback:pause", (payload: unknown) => {
      void mutate(io, redis, socket, payload, { type: "pause" });
    });
    socket.on("playback:seek", (payload: unknown) => {
      const parsed = playbackSeekSchema.safeParse(payload);
      if (!parsed.success) {
        fail(socket, { code: "invalid_payload", message: "playback:seek" });
        return;
      }
      void mutate(io, redis, socket, payload, {
        type: "seek",
        positionMs: parsed.data.positionMs,
      });
    });

    socket.on("playback:sync", async (payload: unknown) => {
      const parsed = playbackSyncRequestSchema.safeParse(payload);
      if (!parsed.success) {
        fail(socket, { code: "invalid_payload", message: "playback:sync" });
        return;
      }
      if (!redis) {
        fail(socket, { code: "redis_unavailable", message: "playback:sync" });
        return;
      }
      const now = Date.now();
      const anchor =
        (await readPlayback(redis.pub, parsed.data.roomId)) ??
        initialPlayback(parsed.data.userId, now);
      socket.emit("playback:sync", snapshotFor(parsed.data.roomId, anchor, now));
    });

    socket.on("clock:ping", (payload: unknown) => {
      const t1 = Date.now();
      const parsed = clockPingSchema.safeParse(payload);
      if (!parsed.success) {
        fail(socket, { code: "invalid_payload", message: "clock:ping" });
        return;
      }
      socket.emit("clock:pong", {
        roomId: parsed.data.roomId,
        t0: parsed.data.t0,
        t1,
        t2: Date.now(),
      });
    });
  });
}

async function depart(
  io: Server,
  redis: RedisPair,
  socket: Socket,
  roomId: string,
  userId: string,
): Promise<void> {
  bindings.delete(socket.id);
  await socket.leave(roomId);
  const members = await leaveRoom(redis.pub, roomId, userId);
  io.to(roomId).emit("room:presence", { roomId, members });
}

async function mutate(
  io: Server,
  redis: RedisPair | null,
  socket: Socket,
  payload: unknown,
  op: { type: "play" | "pause" } | { type: "seek"; positionMs: number },
): Promise<void> {
  const parsed = playbackCommandSchema.safeParse(payload);
  if (!parsed.success) {
    fail(socket, { code: "invalid_payload", message: `playback:${op.type}` });
    return;
  }
  if (!redis) {
    fail(socket, { code: "redis_unavailable", message: `playback:${op.type}` });
    return;
  }
  const hostId = await readHost(redis.pub, parsed.data.roomId);
  if (hostId !== parsed.data.userId) {
    fail(socket, { code: "not_host", message: "only the host moves playback" });
    return;
  }
  const result = await commitPlayback(redis.pub, parsed.data.roomId, {
    ...op,
    actorId: parsed.data.userId,
  });
  if (result === "version_conflict") {
    fail(socket, { code: "version_conflict", message: "playback write lost the race" });
    return;
  }
  io.to(parsed.data.roomId).emit("playback:state", result);
}
