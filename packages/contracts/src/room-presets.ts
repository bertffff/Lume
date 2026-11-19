import type { ViewerDefaultFlags } from "./parity/permissions.js";

export const roomPresetIds = ["cinema", "party", "closed", "moderated"] as const;
export type RoomPresetId = (typeof roomPresetIds)[number];

export interface RoomPreset {
  id: RoomPresetId;
  title: string;
  hint: string;
  isPublic: boolean;
  maxMembers: number;
  hideReactions: boolean;
  slowModeSeconds: number;
  defaults: ViewerDefaultFlags;
}

/**
 * The create-room chips are full configurations, not title suggestions.
 * The API resolves the preset again so a client cannot claim different rights.
 */
export const roomPresets: readonly RoomPreset[] = [
  {
    id: "cinema",
    title: "Киноночь",
    hint: "Закрытая комната на 12 человек: чат, голос и очередь.",
    isPublic: false,
    maxMembers: 12,
    hideReactions: false,
    slowModeSeconds: 0,
    defaults: { canChat: true, canSpeak: true, canReact: true, canQueue: true, canSeek: false, canInvite: true },
  },
  {
    id: "party",
    title: "Вечеринка",
    hint: "Публичная комната на 50 человек со свободным чатом и голосом.",
    isPublic: true,
    maxMembers: 50,
    hideReactions: false,
    slowModeSeconds: 0,
    defaults: { canChat: true, canSpeak: true, canReact: true, canQueue: true, canSeek: false, canInvite: true },
  },
  {
    id: "closed",
    title: "Закрытый",
    hint: "Только по коду, 6 человек, без голоса и очереди.",
    isPublic: false,
    maxMembers: 6,
    hideReactions: false,
    slowModeSeconds: 0,
    defaults: { canChat: true, canSpeak: false, canReact: true, canQueue: false, canSeek: false, canInvite: false },
  },
  {
    id: "moderated",
    title: "С модерацией",
    hint: "Медленный режим 10 секунд, скрытые чужие реакции, приглашения только у хоста.",
    isPublic: false,
    maxMembers: 25,
    hideReactions: true,
    slowModeSeconds: 10,
    defaults: { canChat: true, canSpeak: true, canReact: true, canQueue: true, canSeek: false, canInvite: false },
  },
];

export function roomPresetById(id: string | null | undefined): RoomPreset | null {
  return roomPresets.find((preset) => preset.id === id) ?? null;
}
