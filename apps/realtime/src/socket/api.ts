import type { ChatMessage, QueueItem, RoomSummary, MemberRole } from "@lume/contracts";

export class ApiFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export interface RoomSession {
  room: RoomSummary & { nowPlaying: QueueItem | null };
  self: {
    role: MemberRole;
    muted: boolean;
    permissions: {
      canChat: boolean;
      canSpeak: boolean;
      canReact: boolean;
      canSeek: boolean;
      canInvite: boolean;
      canControlVideo: boolean;
      canAddToQueue: boolean;
      canRemoveFromQueue: boolean;
      canReorderQueue: boolean;
    };
  };
  members: Array<{ userId: string; displayName: string; role: MemberRole; muted: boolean }>;
  messages: ChatMessage[];
  queue: QueueItem[];
}

export function createRoomApi(baseUrl: string) {
  async function request<T>(token: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new ApiFailure(typeof payload.error === "string" ? payload.error : "request_failed");
    }
    return payload as T;
  }

  return {
    session(token: string, roomId: string) {
      return request<RoomSession>(token, `/rooms/${roomId}`);
    },
    sendMessage(token: string, roomId: string, body: string, replyToId?: string | null, imageUrl?: string) {
      return request<ChatMessage>(token, `/rooms/${roomId}/messages`, {
        method: "POST",
        body: { body, replyToId: replyToId ?? null, ...(imageUrl ? { imageUrl } : {}) },
      });
    },
    react(token: string, roomId: string, messageId: string, emoji: string) {
      return request<ChatMessage>(token, `/rooms/${roomId}/reactions`, {
        method: "POST",
        body: { messageId, emoji },
      });
    },
    addQueue(token: string, roomId: string, url: string, title?: string) {
      return request<RoomSession>(token, `/rooms/${roomId}/queue`, {
        method: "POST",
        body: title ? { url, title } : { url },
      });
    },
    playNext(token: string, roomId: string) {
      return request<RoomSession>(token, `/rooms/${roomId}/queue/next`, { method: "POST", body: {} });
    },
    removeQueueItem(token: string, roomId: string, itemId: string) {
      return request<RoomSession>(token, `/rooms/${roomId}/queue/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    },
    moveQueueItem(token: string, roomId: string, itemId: string, direction: "up" | "down") {
      return request<RoomSession>(token, `/rooms/${roomId}/queue/${encodeURIComponent(itemId)}/move`, { method: "POST", body: { direction } });
    },
    playQueueItem(token: string, roomId: string, itemId: string) {
      return request<RoomSession>(token, `/rooms/${roomId}/queue/${encodeURIComponent(itemId)}/play`, { method: "POST", body: {} });
    },
    reloadQueue(token: string, roomId: string, historyId: string) {
      return request<RoomSession>(token, `/rooms/${roomId}/queue/reload`, { method: "POST", body: { historyId } });
    },
    kick(token: string, roomId: string, userId: string) {
      return request<RoomSession>(token, `/rooms/${roomId}/kick`, { method: "POST", body: { userId } });
    },
    mute(token: string, roomId: string, userId: string, muted: boolean) {
      return request<RoomSession>(token, `/rooms/${roomId}/mute`, { method: "POST", body: { userId, muted } });
    },
    setRole(token: string, roomId: string, userId: string, role: "mod" | "viewer") {
      return request<RoomSession>(token, `/rooms/${roomId}/role`, { method: "POST", body: { userId, role } });
    },
    leave(token: string, roomId: string) {
      return request<{ ok: boolean }>(token, `/rooms/${roomId}/leave`, { method: "POST", body: {} });
    },
    muteVoice(token: string, roomId: string, userId?: string) {
      return request<{ muted: string[] }>(token, "/voice/livekit/mute", {
        method: "POST",
        body: userId ? { roomId, userId } : { roomId },
      });
    },
    disconnectVoice(token: string, roomId: string, userId: string) {
      return request<{ disconnected: string }>(token, "/voice/livekit/disconnect", {
        method: "POST",
        body: { roomId, userId },
      });
    },
  };
}

export type RoomApi = ReturnType<typeof createRoomApi>;
