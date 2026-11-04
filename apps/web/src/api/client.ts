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
};
