import type { RoomSummary, User } from "@lume/contracts";

export const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";

export class ClientError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function request<T>(path: string, init?: { method?: string; token?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ClientError(typeof payload.error === "string" ? payload.error : "request_failed");
  }
  return payload as T;
}

export const api = {
  devLogin(displayName: string) {
    return request<{ accessToken: string; user: User }>("/auth/dev", {
      method: "POST",
      body: { displayName },
    });
  },
  listRooms() {
    return request<{ rooms: RoomSummary[] }>("/rooms");
  },
  createRoom(token: string, title: string, isPublic: boolean) {
    return request<{ room: RoomSummary } & Record<string, unknown>>("/rooms", {
      method: "POST",
      token,
      body: { title, isPublic },
    });
  },
  joinRoom(token: string, code: string) {
    return request<{ room: RoomSummary }>("/rooms/join", {
      method: "POST",
      token,
      body: { code },
    });
  },
  leave(token: string, roomId: string) {
    return request<{ ok: boolean }>(`/rooms/${roomId}/leave`, { method: "POST", token, body: {} });
  },
  voiceStatus() {
    return request<{ enabled: boolean }>("/voice/livekit");
  },
  voiceToken(token: string, roomId: string) {
    return request<{ token: string; url: string }>("/voice/livekit/token", {
      method: "POST",
      token,
      body: { roomId },
    });
  },
  me(token: string) {
    return request<Record<string, unknown>>("/me", { token });
  },
  searchUsers(token: string, q: string) {
    return request<{ users: Array<{ id: string; displayName: string; username: string | null }> }>(
      `/users/search?q=${encodeURIComponent(q)}`,
      { token },
    );
  },
  friends(token: string) {
    return request<{
      friends: Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>;
      incoming: Array<{ id: string; userId: string; displayName: string }>;
      outgoing: Array<{ id: string; displayName: string }>;
      blocked: Array<{ id: string; displayName: string }>;
    }>("/friends", { token });
  },
  requestFriend(token: string, userId: string) {
    return request<{ status: string }>("/friends/request", { method: "POST", token, body: { userId } });
  },
  acceptFriend(token: string, id: string) {
    return request<{ status: string }>(`/friends/${id}/accept`, { method: "POST", token, body: {} });
  },
  declineFriend(token: string, id: string) {
    return request<{ ok: boolean }>(`/friends/${id}/decline`, { method: "POST", token, body: {} });
  },
  notifications(token: string) {
    return request<{ unread: number; notifications: Array<{ id: string; title: string; body: string; read: boolean }> }>(
      "/notifications",
      { token },
    );
  },
  resume(token: string) {
    return request<{ resume: { title: string; positionMs: number; queueCount: number; historyCount: number } | null }>(
      "/me/resume",
      { token },
    );
  },
};
