import { voiceDisconnectSchema, voiceJoinSchema, voiceMuteSchema, voiceStateSchema } from "@lume/contracts";
import type { Server, Socket } from "socket.io";
import type { RedisPair } from "../redis.js";
import { clearVoicePresence, listVoicePresence, setVoicePresence } from "../rooms/voice.js";
import { ApiFailure, type RoomApi } from "./api.js";

interface Actor {
  userId: string;
  displayName: string;
  token: string;
}

function actorOf(socket: Socket): Actor | null {
  const data = socket.data as Partial<Actor>;
  if (!data.userId || !data.token) {
    return null;
  }
  return { userId: data.userId, displayName: data.displayName ?? "Гость", token: data.token };
}

function broadcast(io: Server, roomId: string, members: Awaited<ReturnType<typeof listVoicePresence>>): void {
  io.to(roomId).emit("voice:presence", { roomId, members });
}

export function registerVoiceEvents(
  io: Server,
  redis: RedisPair | null,
  api: RoomApi,
  socket: Socket,
): void {
  socket.on("voice:join", (payload: unknown) => {
    void join(io, redis, socket, payload);
  });
  socket.on("voice:leave", (payload: unknown) => {
    void leave(io, redis, socket, payload);
  });
  socket.on("voice:state", (payload: unknown) => {
    void state(io, redis, socket, payload);
  });
  socket.on("voice:mute", (payload: unknown) => {
    void mute(io, redis, api, socket, payload);
  });
  socket.on("voice:disconnect", (payload: unknown) => {
    void disconnect(io, redis, api, socket, payload);
  });
}

export async function clearVoiceOnDepart(io: Server, redis: RedisPair, roomId: string, userId: string): Promise<void> {
  const members = await clearVoicePresence(redis.pub, roomId, userId);
  broadcast(io, roomId, members);
}

async function join(io: Server, redis: RedisPair | null, socket: Socket, payload: unknown): Promise<void> {
  const parsed = voiceJoinSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  const members = await setVoicePresence(redis.pub, parsed.data.roomId, {
    userId: actor.userId,
    muted: false,
    speaking: false,
    joinedAtMs: Date.now(),
  });
  broadcast(io, parsed.data.roomId, members);
}

async function leave(io: Server, redis: RedisPair | null, socket: Socket, payload: unknown): Promise<void> {
  const parsed = voiceJoinSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  await clearVoiceOnDepart(io, redis, parsed.data.roomId, actor.userId);
}

async function state(io: Server, redis: RedisPair | null, socket: Socket, payload: unknown): Promise<void> {
  const parsed = voiceStateSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  const members = await setVoicePresence(redis.pub, parsed.data.roomId, {
    userId: actor.userId,
    muted: parsed.data.muted,
    speaking: parsed.data.speaking,
  });
  broadcast(io, parsed.data.roomId, members);
}

async function mute(io: Server, redis: RedisPair | null, api: RoomApi, socket: Socket, payload: unknown): Promise<void> {
  const parsed = voiceMuteSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  try {
    const result = await api.muteVoice(actor.token, parsed.data.roomId, parsed.data.userId);
    for (const userId of result.muted) {
      const current = (await listSafe(redis, parsed.data.roomId)).find((member) => member.userId === userId);
      if (current) {
        await setVoicePresence(redis.pub, parsed.data.roomId, { ...current, muted: true, speaking: false });
      }
      io.to(parsed.data.roomId).emit("voice:force", { userId, action: "mute" });
    }
    broadcast(io, parsed.data.roomId, await listSafe(redis, parsed.data.roomId));
  } catch (error) {
    socket.emit("room:error", {
      code: error instanceof ApiFailure && error.code === "forbidden" ? "forbidden" : "persistence_unavailable",
      message: "voice:mute",
    });
  }
}

async function disconnect(io: Server, redis: RedisPair | null, api: RoomApi, socket: Socket, payload: unknown): Promise<void> {
  const parsed = voiceDisconnectSchema.safeParse(payload);
  const actor = actorOf(socket);
  if (!parsed.success || !actor || !redis) {
    return;
  }
  try {
    await api.disconnectVoice(actor.token, parsed.data.roomId, parsed.data.userId);
    await clearVoiceOnDepart(io, redis, parsed.data.roomId, parsed.data.userId);
    io.to(parsed.data.roomId).emit("voice:force", { userId: parsed.data.userId, action: "disconnect" });
  } catch (error) {
    socket.emit("room:error", {
      code: error instanceof ApiFailure && error.code === "forbidden" ? "forbidden" : "persistence_unavailable",
      message: "voice:disconnect",
    });
  }
}

function listSafe(redis: RedisPair, roomId: string) {
  return listVoicePresence(redis.pub, roomId);
}