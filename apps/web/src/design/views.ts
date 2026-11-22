import type { MessageKey } from "../i18n/ru.js";

export type View =
  | "home"
  | "room"
  | "search"
  | "create"
  | "join"
  | "settings"
  | "profile"
  | "premium"
  | "auth"
  | "onboarding"
  | "notifications"
  | "missing"
  | "offline"
  | "unavailable";

export const views = new Set<View>([
  "home", "room", "search", "create", "join", "settings",
  "profile", "premium", "auth", "onboarding", "notifications", "missing", "offline", "unavailable",
]);

export function viewFromPath(path: string): View {
  const name = path.replace(/^\//, "").split("/")[0] ?? "";
  return views.has(name as View) ? (name as View) : "home";
}

export function signInErrorKey(code: string): MessageKey {
  if (code === "unauthorized") return "auth.error.unauthorized";
  if (code === "jwt_unconfigured") return "auth.error.jwt";
  if (code === "rate_limited") return "auth.error.rateLimited";
  if (code === "invalid_body") return "auth.error.invalidBody";
  return "auth.error.generic";
}

export function roomErrorKey(code: string): MessageKey {
  if (code === "rate_limited") return "auth.error.rateLimited";
  if (code === "room_full") return "room.error.full";
  if (code === "not_found") return "room.error.notFound";
  if (code === "unauthorized") return "room.error.expired";
  if (code === "invalid_body") return "room.error.invalidBody";
  if (code === "conflict") return "room.error.conflict";
  return "room.error.generic";
}
