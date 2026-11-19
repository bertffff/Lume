import {
  chatMessageSchema,
  playbackSnapshotSchema,
  presenceMemberSchema,
  queueItemSchema,
  roomSummarySchema,
  type ChatMessage,
  type MemberRole,
  type PlaybackSnapshot,
  type PresenceMember,
  type QueueItem,
  type RoomSummary,
} from "@lume/contracts";
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { clockSample, median } from "@lume/contracts";
import { z } from "zod";
import { connectRealtime, realtimeUrl } from "./client.js";

const stateSchema = z.object({
  room: roomSummarySchema.extend({ nowPlaying: queueItemSchema.nullable() }),
  self: z.object({ role: z.enum(["host", "mod", "viewer"]), muted: z.boolean() }),
  members: z.array(presenceMemberSchema),
  messages: z.array(chatMessageSchema),
  queue: z.array(queueItemSchema),
  playback: playbackSnapshotSchema,
});

export interface LiveRoom {
  room: RoomSummary & { nowPlaying: QueueItem | null };
  self: { role: MemberRole; muted: boolean };
  members: PresenceMember[];
  messages: ChatMessage[];
  queue: QueueItem[];
  playback: PlaybackSnapshot;
  viewers: { userId: string; phase: "buffering" | "ready" }[];
  voice: { userId: string; muted: boolean; speaking: boolean; joinedAtMs: number }[];
}

export type ChannelStatus = "off" | "connecting" | "online" | "error";

export function useRoomChannel(input: { token: string; roomId: string; selfId: string } | null) {
  const token = input?.token;
  const roomId = input?.roomId;
  const selfId = input?.selfId;
  const [state, setState] = useState<LiveRoom | null>(null);
  const [status, setStatus] = useState<ChannelStatus>(input ? "connecting" : "off");
  const [error, setError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [skip, setSkip] = useState({ votes: 0, needed: 1 });
  const [typingName, setTypingName] = useState<string | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [heartbeatAt, setHeartbeatAt] = useState<number | null>(null);
  const [floats, setFloats] = useState<Array<{ id: string; emoji: string; x: number; y: number; userId: string }>>([]);
  const [voiceForce, setVoiceForce] = useState<{
    id: number;
    userId: string;
    action: "mute" | "disconnect";
  } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token || !roomId || !selfId) {
      setStatus("off");
      setState(null);
      setSocket(null);
      return;
    }
    let stopped = false;
    let active: Socket | null = null;
    setStatus("connecting");
    setError(null);
    void connectRealtime(realtimeUrl, token)
      .then((client) => {
        if (stopped) {
          client.close();
          return;
        }
        active = client;
        setSocket(client);
        client.on("connect", () => {
          setStatus("online");
          client.emit("room:join", { roomId });
        });
        client.on("connect_error", () => setStatus("error"));
        client.on("disconnect", () => setStatus("error"));
        client.on("room:state", (payload: unknown) => {
          const parsed = stateSchema.safeParse(payload);
          if (parsed.success) {
            setState({ ...parsed.data, viewers: [], voice: [] });
          }
        });
        client.on("room:presence", (payload: unknown) => {
          const parsed = z.object({ members: z.array(presenceMemberSchema) }).safeParse(payload);
          if (!parsed.success) {
            return;
          }
          setState((current) => (current ? { ...current, members: parsed.data.members } : current));
        });
        client.on("playback:state", (payload: unknown) => {
          const parsed = playbackSnapshotSchema.safeParse(payload);
          if (!parsed.success) {
            return;
          }
          setState((current) => (current ? { ...current, playback: parsed.data } : current));
        });
        client.on("chat:message", (payload: unknown) => {
          const parsed = chatMessageSchema.safeParse(payload);
          if (!parsed.success) {
            return;
          }
          setState((current) =>
            current ? { ...current, messages: [...current.messages, parsed.data].slice(-50) } : current,
          );
        });
        client.on("chat:reaction", (payload: unknown) => {
          const parsed = chatMessageSchema.safeParse(payload);
          if (!parsed.success) {
            return;
          }
          setState((current) =>
            current
              ? {
                  ...current,
                  messages: current.messages.map((message) =>
                    message.id === parsed.data.id ? parsed.data : message,
                  ),
                }
              : current,
          );
        });
        client.on("queue:state", (payload: unknown) => {
          const parsed = z
            .object({ queue: z.array(queueItemSchema), nowPlaying: queueItemSchema.nullable() })
            .safeParse(payload);
          if (!parsed.success) {
            return;
          }
          setState((current) =>
            current
              ? {
                  ...current,
                  queue: parsed.data.queue,
                  room: { ...current.room, nowPlaying: parsed.data.nowPlaying },
                }
              : current,
          );
        });
        client.on("room:kicked", (payload: unknown) => {
          const parsed = z.object({ userId: z.string() }).safeParse(payload);
          if (!parsed.success) {
            return;
          }
          if (parsed.data.userId === selfId) {
            setError("kicked");
            return;
          }
          setState((current) =>
            current
              ? { ...current, members: current.members.filter((member) => member.userId !== parsed.data.userId) }
              : current,
          );
        });
        client.on("playback:viewers", (payload: unknown) => {
          const parsed = z
            .object({
              viewers: z.array(z.object({ userId: z.string(), phase: z.enum(["buffering", "ready"]) })),
            })
            .safeParse(payload);
          if (!parsed.success) {
            return;
          }
          setState((current) => (current ? { ...current, viewers: parsed.data.viewers } : current));
        });
        client.on("voice:presence", (payload: unknown) => {
          const parsed = z
            .object({
              members: z.array(
                z.object({
                  userId: z.string(),
                  muted: z.boolean(),
                  speaking: z.boolean(),
                  joinedAtMs: z.number().int().nonnegative().optional(),
                }),
              ),
            })
            .safeParse(payload);
          if (!parsed.success) {
            return;
          }
          const now = Date.now();
          setState((current) =>
            current
              ? {
                  ...current,
                  voice: parsed.data.members.map((member) => ({ ...member, joinedAtMs: member.joinedAtMs ?? now })),
                }
              : current,
          );
        });
        client.on("voice:force", (payload: unknown) => {
          const parsed = z
            .object({ userId: z.string(), action: z.enum(["mute", "disconnect"]) })
            .safeParse(payload);
          if (!parsed.success) {
            return;
          }
          setVoiceForce({ id: Date.now(), ...parsed.data });
        });
        client.on("playback:skip-votes", (payload: unknown) => {
          const parsed = z.object({ votes: z.number(), needed: z.number() }).safeParse(payload);
          if (parsed.success) setSkip(parsed.data);
        });
        client.on("playback:heartbeat", (payload: { sentAtMs?: number }) => {
          if (typeof payload?.sentAtMs === "number") setHeartbeatAt(payload.sentAtMs);
        });
        client.on("chat:typing", (payload: unknown) => {
          const parsed = z.object({ displayName: z.string() }).safeParse(payload);
          if (!parsed.success) return;
          setTypingName(parsed.data.displayName);
          setTypingNames((current) => (current.includes(parsed.data.displayName) ? current : [...current, parsed.data.displayName]));
          window.setTimeout(() => {
            setTypingName(null);
            setTypingNames((current) => current.filter((name) => name !== parsed.data.displayName));
          }, 3000);
        });
        client.on("reaction:float", (payload: unknown) => {
          const parsed = z.object({ id: z.string(), emoji: z.string(), x: z.number(), y: z.number(), userId: z.string() }).safeParse(payload);
          if (!parsed.success) return;
          setFloats((current) => [...current.slice(-12), parsed.data]);
          window.setTimeout(() => setFloats((current) => current.filter((item) => item.id !== parsed.data.id)), 2400);
        });
        client.on("room:error", (payload: unknown) => {
          const parsed = z.object({ code: z.string() }).safeParse(payload);
          if (parsed.success) {
            setError(parsed.data.code);
          }
        });
      })
      .catch(() => {
        if (!stopped) {
          setStatus("error");
        }
      });
    return () => {
      stopped = true;
      active?.close();
      setSocket(null);
    };
  }, [roomId, selfId, token]);

  useEffect(() => {
    if (!socket || !roomId) return;
    let stopped = false;
    const room = roomId;
    const sampleRound = async () => {
      const samples: number[] = [];
      for (let index = 0; index < 5 && !stopped; index += 1) {
        const t0 = Date.now();
        const offset = await new Promise<number>((resolve) => {
          const timer = window.setTimeout(() => resolve(0), 3000);
          const onPong = (payload: unknown) => {
            window.clearTimeout(timer);
            const parsed = z.object({ t0: z.number(), t1: z.number() }).safeParse(payload);
            resolve(parsed.success ? clockSample(parsed.data.t0, parsed.data.t1, Date.now()).offsetMs : 0);
          };
          socket.once("clock:pong", onPong);
          socket.emit("clock:ping", { roomId: room, t0 });
        });
        samples.push(offset);
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
      if (!stopped && samples.length > 0) setClockOffset(median(samples));
    };
    void sampleRound();
    const again = window.setInterval(() => void sampleRound(), 60_000);
    return () => {
      stopped = true;
      window.clearInterval(again);
    };
  }, [roomId, socket]);

  function emit(event: string, payload: unknown) {
    socket?.emit(event, payload);
  }

  return {
    state,
    status,
    error,
    sendChat(body: string, replyToId?: string | null) {
      if (!roomId) {
        return;
      }
      emit("chat:send", { roomId, body, replyToId: replyToId ?? null });
    },
    react(messageId: string, emoji: string) {
      if (!roomId) {
        return;
      }
      emit("chat:react", { roomId, messageId, emoji });
    },
    addQueue(url: string, title?: string) {
      if (!roomId) {
        return;
      }
      emit("queue:add", title ? { roomId, url, title } : { roomId, url });
    },
    playNext() {
      if (!roomId) {
        return;
      }
      emit("queue:next", { roomId });
    },
    reloadHistory(historyId: string) {
      if (!roomId) {
        return;
      }
      emit("queue:reload", { roomId, historyId });
    },
    setPlayback(mode: "play" | "pause" | "seek", positionMs: number) {
      if (!roomId) {
        return;
      }
      const event = mode === "seek" ? "playback:seek" : mode === "play" ? "playback:play" : "playback:pause";
      emit(event, { roomId, clientTimeMs: Date.now(), positionMs: Math.max(0, Math.round(positionMs)) });
    },
    reportViewer(phase: "buffering" | "ready") {
      if (!roomId) {
        return;
      }
      emit("playback:viewer", { roomId, phase });
    },
    token: token ?? "",
    voiceForce,
    joinVoicePresence() {
      if (!roomId) {
        return;
      }
      emit("voice:join", { roomId });
    },
    leaveVoicePresence() {
      if (!roomId) {
        return;
      }
      emit("voice:leave", { roomId });
    },
    reportVoice(muted: boolean, speaking: boolean) {
      if (!roomId) {
        return;
      }
      emit("voice:state", { roomId, muted, speaking });
    },
    muteVoices(userId?: string) {
      if (!roomId) {
        return;
      }
      emit("voice:mute", userId ? { roomId, userId } : { roomId });
    },
    disconnectVoice(userId: string) {
      if (!roomId) {
        return;
      }
      emit("voice:disconnect", { roomId, userId });
    },
    kick(userId: string) {
      if (!roomId) {
        return;
      }
      emit("mod:kick", { roomId, userId });
    },
    mute(userId: string, muted: boolean) {
      if (!roomId) {
        return;
      }
      emit("mod:mute", { roomId, userId, muted });
    },
    promote(userId: string) {
      if (!roomId) {
        return;
      }
      emit("mod:role", { roomId, userId, role: "mod" });
    },
    clockOffset,
    skip,
    typingName,
    typingNames,
    heartbeatAt,
    floats,
    voteSkip(withdraw = false) {
      if (!roomId) return;
      emit("playback:vote-skip", { roomId, withdraw });
    },
    sendTyping() {
      if (!roomId) return;
      emit("chat:typing", { roomId });
    },
    sendFloat(emoji: string) {
      if (!roomId) return;
      emit("reaction:send", { roomId, emoji });
    },
    heartbeat() {
      if (!roomId) return;
      emit("playback:heartbeat", { roomId, sentAtMs: Date.now() });
    },
  };
}
