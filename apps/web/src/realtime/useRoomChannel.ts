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
}

export type ChannelStatus = "off" | "connecting" | "online" | "error";

export function useRoomChannel(input: { token: string; roomId: string; selfId: string } | null) {
  const [state, setState] = useState<LiveRoom | null>(null);
  const [status, setStatus] = useState<ChannelStatus>(input ? "connecting" : "off");
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!input) {
      setStatus("off");
      setState(null);
      setSocket(null);
      return;
    }
    let stopped = false;
    let active: Socket | null = null;
    setStatus("connecting");
    setError(null);
    void connectRealtime(realtimeUrl, input.token)
      .then((client) => {
        if (stopped) {
          client.close();
          return;
        }
        active = client;
        setSocket(client);
        client.on("connect", () => {
          setStatus("online");
          client.emit("room:join", { roomId: input.roomId });
        });
        client.on("connect_error", () => setStatus("error"));
        client.on("disconnect", () => setStatus("error"));
        client.on("room:state", (payload: unknown) => {
          const parsed = stateSchema.safeParse(payload);
          if (parsed.success) {
            setState(parsed.data);
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
          if (parsed.data.userId === input.selfId) {
            setError("kicked");
            return;
          }
          setState((current) =>
            current
              ? { ...current, members: current.members.filter((member) => member.userId !== parsed.data.userId) }
              : current,
          );
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
  }, [input?.roomId, input?.token, input?.selfId]);

  function emit(event: string, payload: unknown) {
    socket?.emit(event, payload);
  }

  const roomId = input?.roomId;
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
    addQueue(url: string) {
      if (!roomId) {
        return;
      }
      emit("queue:add", { roomId, url });
    },
    playNext() {
      if (!roomId) {
        return;
      }
      emit("queue:next", { roomId });
    },
    togglePlayback() {
      if (!roomId || !state) {
        return;
      }
      const event = state.playback.status === "playing" ? "playback:pause" : "playback:play";
      emit(event, { roomId, clientTimeMs: Date.now() });
    },
    seekForward() {
      if (!roomId || !state) {
        return;
      }
      emit("playback:seek", {
        roomId,
        clientTimeMs: Date.now(),
        positionMs: state.playback.positionMs + 15_000,
      });
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
  };
}
