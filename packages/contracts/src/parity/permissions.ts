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

/** The six host-editable defaults from the room settings sheet. */
export interface ViewerDefaultFlags {
  canChat: boolean;
  canQueue: boolean;
  canSpeak: boolean;
  canReact: boolean;
  canSeek: boolean;
  canInvite: boolean;
}

/** Every per-member flag stored on RoomMember. */
export interface MemberPermissionFlags {
  canChat: boolean;
  canSpeak: boolean;
  canReact: boolean;
  canSeek: boolean;
  canInvite: boolean;
  canControlVideo: boolean;
  canAddToQueue: boolean;
  canRemoveFromQueue: boolean;
  canReorderQueue: boolean;
}

export const defaultViewerFlags: ViewerDefaultFlags = {
  canChat: true,
  canQueue: true,
  canSpeak: true,
  canReact: true,
  canSeek: false,
  canInvite: true,
};

/**
 * Projects the six room defaults onto a member that has no personal overrides.
 * `canQueue` becomes the stored `canAddToQueue`; the remaining keys keep their name.
 */
export function memberFlagsFromDefaults(
  defaults: Partial<ViewerDefaultFlags> | null | undefined,
): Pick<MemberPermissionFlags, "canChat" | "canSpeak" | "canReact" | "canSeek" | "canInvite" | "canAddToQueue"> {
  const merged = { ...defaultViewerFlags, ...(defaults ?? {}) };
  return {
    canChat: merged.canChat,
    canSpeak: merged.canSpeak,
    canReact: merged.canReact,
    canSeek: merged.canSeek,
    canInvite: merged.canInvite,
    canAddToQueue: merged.canQueue,
  };
}

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
