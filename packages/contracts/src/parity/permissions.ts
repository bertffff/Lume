import type { MemberRole } from "../roles.js";

export interface ViewerPermissions {
  canChat: boolean;
  canSpeak: boolean;
  canControlVideo: boolean;
  canAddToQueue: boolean;
  canRemoveFromQueue: boolean;
  canReorderQueue: boolean;
}

export const defaultViewerPermissions: ViewerPermissions = {
  canChat: true,
  canSpeak: true,
  canControlVideo: false,
  canAddToQueue: true,
  canRemoveFromQueue: false,
  canReorderQueue: false,
};

export type RoomAction =
  | "playback"
  | "refreshUrl"
  | "queueAdd"
  | "queueRemove"
  | "queueReorder"
  | "queuePlay"
  | "clearHistory"
  | "chat"
  | "speak"
  | "pin"
  | "settings"
  | "vote"
  | "react"
  | "invite"
  | "report";

export type ModerationActionName =
  | "kick"
  | "ban"
  | "mute"
  | "slow"
  | "permissions"
  | "makeHost"
  | "log";

/** Hosts bypass the six flags. Moderators use the same flags as viewers, except pin. */
export function allowsAction(
  role: MemberRole,
  action: RoomAction,
  permissions: ViewerPermissions,
): boolean {
  if (role === "host") {
    return true;
  }
  switch (action) {
    case "playback":
      return permissions.canControlVideo;
    case "refreshUrl":
    case "vote":
    case "react":
    case "invite":
    case "report":
      return true;
    case "queueAdd":
      return permissions.canAddToQueue;
    case "queueRemove":
      return permissions.canRemoveFromQueue;
    case "queueReorder":
      return permissions.canReorderQueue;
    case "queuePlay":
    case "clearHistory":
    case "settings":
      return false;
    case "chat":
      return permissions.canChat;
    case "speak":
      return permissions.canSpeak;
    case "pin":
      return role === "mod";
    default:
      return false;
  }
}

/**
 * Moderators may kick, temp-mute, change slow mode, and read the log.
 * Ban, room settings, and host transfer stay with the host.
 */
export function allowsModeration(role: MemberRole, action: ModerationActionName): boolean {
  if (role === "host") {
    return true;
  }
  if (role !== "mod") {
    return false;
  }
  return action === "kick" || action === "mute" || action === "slow" || action === "log";
}
