import type { RoomSummary, User } from "@lume/contracts";

export const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";

export class ClientError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function shouldRefresh(status: number, refreshToken: string | undefined, tried: boolean): boolean {
  return status === 401 && Boolean(refreshToken) && !tried;
}

async function request<T>(path: string, init?: { method?: string; token?: string; body?: unknown }, tried = false): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 401 && !tried && path !== "/auth/refresh") {
    const raw = window.localStorage.getItem("lume.session");
    const session = raw ? (JSON.parse(raw) as { accessToken?: string; refreshToken?: string }) : null;
    if (shouldRefresh(401, session?.refreshToken, tried)) {
      const refreshed = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: session?.refreshToken }),
      });
      if (refreshed.ok && raw && session) {
        const next = (await refreshed.json()) as { accessToken: string; refreshToken: string };
        window.localStorage.setItem("lume.session", JSON.stringify({ ...JSON.parse(raw), ...next }));
        return request(path, { ...init, token: next.accessToken }, true);
      }
    }
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ClientError(typeof payload.error === "string" ? payload.error : "request_failed");
  }
  return payload as T;
}

export const api = {
  devLogin(displayName: string) {
    return request<{ accessToken: string; refreshToken?: string; user: User }>("/auth/dev", {
      method: "POST",
      body: { displayName },
    });
  },
  listRooms(query = "") {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    return request<{ rooms: RoomSummary[] }>(`/rooms${suffix}`);
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
    return request<{ enabled: boolean; stub?: boolean }>("/voice/livekit");
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
  logout(refreshToken: string) {
    return request<{ ok: boolean }>("/auth/logout", { method: "POST", body: { refreshToken } });
  },
  verifyMagic(token: string) {
    return request<{ accessToken: string; refreshToken: string; user: User }>("/auth/magic-link/verify", {
      method: "POST",
      body: { token },
    });
  },
  linkedAccounts(token: string) {
    return request<{ email: boolean; telegram: boolean }>("/auth/linked-accounts", { token });
  },
  linkTelegram(token: string, telegramId: string) {
    return request<{ linked: boolean }>("/auth/link-telegram", { method: "POST", token, body: { telegramId } });
  },
  unlinkTelegram(token: string) {
    return request<{ linked: boolean }>("/auth/unlink-telegram", { method: "POST", token });
  },
};
