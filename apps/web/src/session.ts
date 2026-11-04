import type { User } from "@lume/contracts";

const storageKey = "lume.session";

export interface ClientSession {
  accessToken: string;
  user: User;
}

export function loadSession(): ClientSession | null {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ClientSession;
    if (!parsed.accessToken || !parsed.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: ClientSession): void {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(storageKey);
}
