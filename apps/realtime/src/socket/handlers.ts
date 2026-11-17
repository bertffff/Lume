import {
  canControlPlayback,
  holdPlaybackOp,
  hostLeavePauses,
  castSkipVote,
  chatReactSchema,
  chatSendSchema,
  clockPingSchema,
  foreignOwnerIndex,
  initialPlayback,
  modKickSchema,
  modMuteSchema,
  modRoleSchema,
  playbackCommandSchema,
  playbackSeekSchema,
  playbackSyncRequestSchema,
  playbackViewerSchema,
  queueAddSchema,
  roomJoinSchema,
  roomLeaveSchema,
  withdrawSkipVote,
  type MemberRole,
  type RoomError,
} from "@lume/contracts";
import { verifyAccessToken } from "@lume/contracts/node";
import { z } from "zod";
import type { Server, Socket } from "socket.io";
import type { RealtimeEnv } from "../env.js";
import type { RedisPair } from "../redis.js";
import { commitPlayback, readPlayback, snapshotFor } from "../rooms/playback.js";
import { joinRoom, leaveRoom, listMembers } from "../rooms/presence.js";
import { listViewerPhases, setViewerPhase, clearViewerPhase } from "../rooms/viewers.js";
import { ApiFailure, createRoomApi, type RoomApi, type RoomSession } from "./api.js";
import { clearVoiceOnDepart, registerVoiceEvents } from "./voice.js";

interface Binding {
  roomId: string;
  userId: string;
}

interface Actor {
  userId: string;
  displayName: string;
  token: string;
}

const bindings = new Map<string, Binding>();

function fail(socket: Socket, error: RoomError): void {
  socket.emit("room:error", error);
}

function actorOf(socket: Socket): Actor | null {
  const data = socket.data as Partial<Actor>;
  if (!data.userId || !data.token) {
    return null;
  }
  return {
    userId: data.userId,
    displayName: data.displayName ?? "Гость",
    token: data.token,
  };
}

function mapFailure(error: unknown): RoomError["code"] {
  if (error instanceof ApiFailure) {
    const known: RoomError["code"][] = [
      "forbidden",
      "muted",
      "not_member",
      "room_full",
      "invalid_media",
      "empty_queue",
      "not_found",
    ];
    if (known.includes(error.code as RoomError["code"])) {
      return error.code as RoomError["code"];
    }
    if (error.code === "unauthorized") {
      return "unauthorized";
    }
  }
  return "persistence_unavailable";
}

export function registerSocketHandlers(io: Server, env: RealtimeEnv, redis: RedisPair | null): void {
  const api = createRoomApi(env.API_URL);
  io.use(async (socket, next) => {
    try {
      if (!env.JWT_SECRET) {
        next(new Error("unauthorized"));
        return;
      }
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string") {
        next(new Error("unauthorized"));
        return;
      }
      const claims = await verifyAccessToken(env.JWT_SECRET, token);
      Object.assign(socket.data, {
        userId: claims.userId,
        displayName: claims.displayName,
        token,
      });
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:join", (payload: unknown) => {
      void join(io, env, redis, api, socket, payload);
    });
    socket.on("room:leave", (payload: unknown) => {
      void onLeave(io, redis, api, socket, payload);
    });
    socket.on("disconnect", () => {
      void onDisconnect(io, redis, socket);
    });
    socket.on("playback:play", (payload: unknown) => {
      void control(io, redis, socket, payload, { type: "play" });
    });
    socket.on("playback:pause", (payload: unknown) => {
      void control(io, redis, socket, payload, { type: "pause" });
    });
    socket.on("playback:seek", (payload: unknown) => {
      const parsed = playbackSeekSchema.safeParse(payload);
      if (!parsed.success) {
        fail(socket, { code: "invalid_payload", message: "playback:seek" });
        return;
      }
      void control(io, redis, socket, payload, { type: "seek", positionMs: parsed.data.positionMs });
    });
    socket.on("playback:sync", (payload: unknown) => {
      void sync(redis, socket, payload);
    });
    socket.on("playback:viewer", (payload: unknown) => {
      void reportViewer(io, redis, socket, payload);
    });
    socket.on("clock:ping", (payload: unknown) => {
      const t1 = Date.now();
      const parsed = clockPingSchema.safeParse(payload);
      if (!parsed.success) {
        fail(socket, { code: "invalid_payload", message: "clock:ping" });
        return;
      }
      socket.emit("clock:pong", { roomId: parsed.data.roomId, t0: parsed.data.t0, t1, t2: Date.now() });
    });
    socket.on("chat:send", (payload: unknown) => {
      void chatSend(io, api, socket, payload);
    });
    socket.on("chat:react", (payload: unknown) => {
      void chatReact(io, api, socket, payload);
    });
    socket.on("queue:add", (payload: unknown) => {
      void queueAdd(io, api, socket, payload);
    });
    socket.on("queue:next", (payload: unknown) => {
      void queueNext(io, redis, api, socket, payload);
    });
    socket.on("mod:kick", (payload: unknown) => {
      void moderate(io, redis, api, socket, payload, "kick");
    });
    socket.on("mod:mute", (payload: unknown) => {
      void moderate(io, redis, api, socket, payload, "mute");
    });
    socket.on("mod:role", (payload: unknown) => {
      void moderate(io, redis, api, socket, payload, "role");
    });
    registerVoiceEvents(io, redis, api, socket);
    socket.on("playback:vote-skip", (payload: unknown) => {
      void voteSkip(io, redis, api, socket, payload);
    });
    socket.on("playback:heartbeat", (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const data = payload as { roomId?: string; sentAtMs?: number };
      if (!data.roomId || typeof data.sentAtMs !== "number") return;
      io.to(data.roomId).emit("playback:heartbeat", { roomId: data.roomId, sentAtMs: data.sentAtMs });
    });
    socket.on("chat:typing", (payload: unknown) => {
      const parsed = z.object({ roomId: z.string().min(1) }).safeParse(payload);
      const actor = actorOf(socket);
      if (!parsed.success || !actor) return;
      socket.to(parsed.data.roomId).emit("chat:typing", { userId: actor.userId, displayName: actor.displayName });
    });
    socket.on("reaction:send", (payload: unknown) => {
      const parsed = z.object({ roomId: z.string().min(1), emoji: z.string().min(1).max(8) }).safeParse(payload);
      const actor = actorOf(socket);
      if (!parsed.success || !actor) return;
      io.to(parsed.data.roomId).emit("reaction:float", {
        id: `${actor.userId}-${Date.now()}`,
        emoji: parsed.data.emoji,
        userId: actor.userId,
        x: 10 + Math.random() * 80,
        y: 30 + Math.random() * 40,
      });
    });
  });
}

async function voteSkip(io: Server, redis: RedisPair | null, api: RoomApi, socket: Socket, payload: unknown): Promise<void> {
  const parsed = z.object({ roomId: z.string().min(1), withdraw: z.boolean().optional() }).safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  const key = `lume:room:${parsed.data.roomId}:skip`;
  if (parsed.data.withdraw) {
    await redis.pub.srem(key, actor.userId);
  } else {
    await redis.pub.sadd(key, actor.userId);
  }
  const members = await listMembers(redis.pub, parsed.data.roomId);
  const self = members.find((member) => member.userId === actor.userId);
  const votes = parsed.data.withdraw
    ? withdrawSkipVote(await redis.pub.smembers(key), actor.userId)
    : await redis.pub.smembers(key);
  const result = castSkipVote({
    memberCount: Math.max(1, members.length),
    votes,
    voterId: actor.userId,
    isHost: self?.role === "host",
  });
  io.to(parsed.data.roomId).emit("playback:skip-votes", {
    roomId: parsed.data.roomId,
    votes: result.votes.length,
    needed: result.needed,
  });
  if (result.skipped) {
    await redis.pub.del(key);
    try {
      const session = await api.playNext(actor.token, parsed.data.roomId);
      io.to(parsed.data.roomId).emit("room:state", session);
    } catch (error) {
      fail(socket, { code: mapFailure(error), message: "playback:vote-skip" });
    }
  }
}

async function join(
  io: Server,
  env: RealtimeEnv,
  redis: RedisPair | null,
  api: RoomApi,
  socket: Socket,
  payload: unknown,
): Promise<void> {
  const parsed = roomJoinSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor) {
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
    fail(socket, { code: "not_owner", message: "room writes are pinned to another replica", ownerIndex });
    return;
  }
  let session: RoomSession;
  try {
    session = await api.session(actor.token, parsed.data.roomId);
  } catch (error) {
    fail(socket, { code: mapFailure(error), message: "room:join" });
    return;
  }
  const joined = await joinRoom(redis.pub, parsed.data.roomId, {
    userId: actor.userId,
    displayName: actor.displayName,
    role: session.self.role,
    muted: session.self.muted,
    joinedAtMs: Date.now(),
  });
  await socket.join(parsed.data.roomId);
  bindings.set(socket.id, { roomId: parsed.data.roomId, userId: actor.userId });
  const anchor =
    (await readPlayback(redis.pub, parsed.data.roomId)) ?? initialPlayback(session.room.hostId, Date.now());
  socket.emit("room:state", {
    room: session.room,
    self: session.self,
    members: joined.members,
    messages: session.messages,
    queue: session.queue,
    playback: snapshotFor(parsed.data.roomId, anchor, Date.now()),
  });
  io.to(parsed.data.roomId).emit("room:presence", { roomId: parsed.data.roomId, members: joined.members });
}

async function control(
  io: Server,
  redis: RedisPair | null,
  socket: Socket,
  payload: unknown,
  op: { type: "play" | "pause" } | { type: "seek"; positionMs: number },
): Promise<void> {
  const parsed = playbackCommandSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor) {
    fail(socket, { code: "invalid_payload", message: `playback:${op.type}` });
    return;
  }
  if (!redis) {
    fail(socket, { code: "redis_unavailable", message: `playback:${op.type}` });
    return;
  }
  const role = await roleOf(redis, parsed.data.roomId, actor.userId);
  if (!role || !canControlPlayback(role)) {
    fail(socket, { code: "forbidden", message: "only the host or a mod moves playback" });
    return;
  }
  const viewers = await listViewerPhases(redis.pub, parsed.data.roomId);
  const buffering = viewers.filter((viewer) => viewer.phase === "buffering").length;
  const requested =
    op.type === "seek"
      ? { type: "seek" as const, actorId: actor.userId, positionMs: op.positionMs }
      : parsed.data.positionMs === undefined
        ? { type: op.type, actorId: actor.userId }
        : { type: op.type, actorId: actor.userId, positionMs: parsed.data.positionMs };
  const held = holdPlaybackOp(requested, buffering);
  const result = await commitPlayback(redis.pub, parsed.data.roomId, held);
  if (result === "version_conflict") {
    fail(socket, { code: "version_conflict", message: "playback write lost the race" });
    return;
  }
  io.to(parsed.data.roomId).emit("playback:state", result);
}

async function sync(redis: RedisPair | null, socket: Socket, payload: unknown): Promise<void> {
  const parsed = playbackSyncRequestSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor) {
    fail(socket, { code: "invalid_payload", message: "playback:sync" });
    return;
  }
  if (!redis) {
    fail(socket, { code: "redis_unavailable", message: "playback:sync" });
    return;
  }
  const now = Date.now();
  const anchor = (await readPlayback(redis.pub, parsed.data.roomId)) ?? initialPlayback(actor.userId, now);
  socket.emit("playback:sync", snapshotFor(parsed.data.roomId, anchor, now));
}

async function chatSend(io: Server, api: RoomApi, socket: Socket, payload: unknown): Promise<void> {
  const parsed = chatSendSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor) {
    fail(socket, { code: "invalid_payload", message: "chat:send" });
    return;
  }
  try {
    const message = await api.sendMessage(actor.token, parsed.data.roomId, parsed.data.body, parsed.data.replyToId);
    io.to(parsed.data.roomId).emit("chat:message", message);
  } catch (error) {
    fail(socket, { code: mapFailure(error), message: "chat:send" });
  }
}

async function chatReact(io: Server, api: RoomApi, socket: Socket, payload: unknown): Promise<void> {
  const parsed = chatReactSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor) {
    fail(socket, { code: "invalid_payload", message: "chat:react" });
    return;
  }
  try {
    const message = await api.react(actor.token, parsed.data.roomId, parsed.data.messageId, parsed.data.emoji);
    io.to(parsed.data.roomId).emit("chat:reaction", message);
  } catch (error) {
    fail(socket, { code: mapFailure(error), message: "chat:react" });
  }
}

async function queueAdd(io: Server, api: RoomApi, socket: Socket, payload: unknown): Promise<void> {
  const parsed = queueAddSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor) {
    fail(socket, { code: "invalid_payload", message: "queue:add" });
    return;
  }
  try {
    const session = await api.addQueue(actor.token, parsed.data.roomId, parsed.data.url);
    io.to(parsed.data.roomId).emit("queue:state", {
      roomId: parsed.data.roomId,
      queue: session.queue,
      nowPlaying: session.room.nowPlaying,
    });
  } catch (error) {
    fail(socket, { code: mapFailure(error), message: "queue:add" });
  }
}

async function queueNext(
  io: Server,
  redis: RedisPair | null,
  api: RoomApi,
  socket: Socket,
  payload: unknown,
): Promise<void> {
  const parsed = roomJoinSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor) {
    fail(socket, { code: "invalid_payload", message: "queue:next" });
    return;
  }
  try {
    const session = await api.playNext(actor.token, parsed.data.roomId);
    io.to(parsed.data.roomId).emit("queue:state", {
      roomId: parsed.data.roomId,
      queue: session.queue,
      nowPlaying: session.room.nowPlaying,
    });
    if (redis) {
      const snapshot = await commitPlayback(redis.pub, parsed.data.roomId, {
        type: "seek",
        actorId: actor.userId,
        positionMs: 0,
      });
      if (snapshot !== "version_conflict") {
        const paused = await commitPlayback(redis.pub, parsed.data.roomId, {
          type: "pause",
          actorId: actor.userId,
        });
        if (paused !== "version_conflict") {
          io.to(parsed.data.roomId).emit("playback:state", paused);
        }
      }
    }
  } catch (error) {
    fail(socket, { code: mapFailure(error), message: "queue:next" });
  }
}

async function moderate(
  io: Server,
  redis: RedisPair | null,
  api: RoomApi,
  socket: Socket,
  payload: unknown,
  kind: "kick" | "mute" | "role",
): Promise<void> {
  const actor = actorOf(socket);
  const kick = kind === "kick" ? modKickSchema.safeParse(payload) : null;
  const mute = kind === "mute" ? modMuteSchema.safeParse(payload) : null;
  const role = kind === "role" ? modRoleSchema.safeParse(payload) : null;
  const parsed = kick ?? mute ?? role;
  if (!parsed?.success || !actor || !redis) {
    fail(socket, { code: parsed?.success ? "redis_unavailable" : "invalid_payload", message: `mod:${kind}` });
    return;
  }
  const data = parsed.data;
  try {
    const session =
      kind === "kick"
        ? await api.kick(actor.token, data.roomId, data.userId)
        : mute?.success
          ? await api.mute(actor.token, mute.data.roomId, mute.data.userId, mute.data.muted)
          : role?.success
            ? await api.setRole(actor.token, role.data.roomId, role.data.userId, role.data.role)
            : null;
    if (!session) {
      return;
    }
    if (kind === "kick") {
      await leaveRoom(redis.pub, data.roomId, data.userId);
      io.to(data.roomId).emit("room:kicked", { roomId: data.roomId, userId: data.userId });
    } else {
      const current = (await listMembers(redis.pub, data.roomId)).find((member) => member.userId === data.userId);
      const next = session.members.find((member) => member.userId === data.userId);
      if (current && next) {
        await joinRoom(redis.pub, data.roomId, { ...current, role: next.role, muted: next.muted });
      }
    }
    const members = await listMembers(redis.pub, data.roomId);
    io.to(data.roomId).emit("room:presence", { roomId: data.roomId, members });
  } catch (error) {
    fail(socket, { code: mapFailure(error), message: `mod:${kind}` });
  }
}

async function onLeave(
  io: Server,
  redis: RedisPair | null,
  api: RoomApi,
  socket: Socket,
  payload: unknown,
): Promise<void> {
  const parsed = roomLeaveSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  try {
    const role = await roleOf(redis, parsed.data.roomId, actor.userId);
    await api.leave(actor.token, parsed.data.roomId);
    if (hostLeavePauses(role ?? "")) {
      const paused = await commitPlayback(redis.pub, parsed.data.roomId, { type: "pause", actorId: actor.userId });
      if (paused !== "version_conflict") {
        io.to(parsed.data.roomId).emit("playback:state", paused);
      }
    }
  } catch {
    // Presence still drops if the membership row was already gone.
  }
  await depart(io, redis, socket, parsed.data.roomId, actor.userId);
}

async function onDisconnect(io: Server, redis: RedisPair | null, socket: Socket): Promise<void> {
  const binding = bindings.get(socket.id);
  if (!binding || !redis) {
    bindings.delete(socket.id);
    return;
  }
  await depart(io, redis, socket, binding.roomId, binding.userId);
}

async function depart(io: Server, redis: RedisPair, socket: Socket, roomId: string, userId: string): Promise<void> {
  bindings.delete(socket.id);
  await socket.leave(roomId);
  await clearViewerPhase(redis.pub, roomId, userId);
  await clearVoiceOnDepart(io, redis, roomId, userId);
  const members = await leaveRoom(redis.pub, roomId, userId);
  io.to(roomId).emit("room:presence", { roomId, members });
  io.to(roomId).emit("playback:viewers", { roomId, viewers: await listViewerPhases(redis.pub, roomId) });
}

async function reportViewer(io: Server, redis: RedisPair | null, socket: Socket, payload: unknown): Promise<void> {
  const parsed = playbackViewerSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  await setViewerPhase(redis.pub, parsed.data.roomId, actor.userId, parsed.data.phase);
  io.to(parsed.data.roomId).emit("playback:viewers", {
    roomId: parsed.data.roomId,
    viewers: await listViewerPhases(redis.pub, parsed.data.roomId),
  });
}

async function roleOf(redis: RedisPair, roomId: string, userId: string): Promise<MemberRole | null> {
  const member = (await listMembers(redis.pub, roomId)).find((item) => item.userId === userId);
  return member?.role ?? null;
}
