import { parseRoomCode } from "@lume/contracts";

/**
 * Telegram `/start` payloads are either `room_<code>` or a bare code.
 * `user_<id>` links are deliberately not room codes.
 */
export function roomCodeFromStartPayload(payload: string | undefined): string | null {
  const value = payload?.trim();
  if (!value) return null;
  if (value.startsWith("user_")) return null;
  return parseRoomCode(value.startsWith("room_") ? value.slice("room_".length) : value);
}

/** Adds `tgWebAppStartParam`, which the web client exposes as `start_param`. */
export function miniAppUrl(base: string, roomCode: string | null): string {
  const url = new URL(base);
  const code = roomCode ? parseRoomCode(roomCode) : null;
  if (code) {
    url.searchParams.set("tgWebAppStartParam", `room_${code}`);
  } else if (url.searchParams.get("tgWebAppStartParam")?.startsWith("room_")) {
    // A configured base URL must not republish an invite on a plain/invalid start.
    url.searchParams.delete("tgWebAppStartParam");
  }
  return url.toString();
}
