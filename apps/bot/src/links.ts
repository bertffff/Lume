const roomCodePattern = /^[a-z0-9]{4,32}$/i;

/**
 * Telegram `/start` payloads are either `room_<code>` or a bare code.
 * `user_<id>` links are deliberately not room codes.
 */
export function roomCodeFromStartPayload(payload: string | undefined): string | null {
  const value = payload?.trim();
  if (!value) return null;
  if (value.startsWith("room_")) {
    const code = value.slice("room_".length);
    return roomCodePattern.test(code) ? code : null;
  }
  if (value.startsWith("user_")) return null;
  return roomCodePattern.test(value) ? value : null;
}

/** Adds `tgWebAppStartParam`, which the web client exposes as `start_param`. */
export function miniAppUrl(base: string, roomCode: string | null): string {
  const url = new URL(base);
  if (roomCode) {
    url.searchParams.set("tgWebAppStartParam", `room_${roomCode}`);
  }
  return url.toString();
}
