import ruCommon from "../../../../docs/legacy-locales/ru/common.json";
import enCommon from "../../../../docs/legacy-locales/en/common.json";
import ruRoom from "../../../../docs/legacy-locales/ru/room.json";
import enRoom from "../../../../docs/legacy-locales/en/room.json";
import ruChat from "../../../../docs/legacy-locales/ru/chat.json";
import enChat from "../../../../docs/legacy-locales/en/chat.json";
import ruPlayer from "../../../../docs/legacy-locales/ru/player.json";
import enPlayer from "../../../../docs/legacy-locales/en/player.json";
import ruAuth from "../../../../docs/legacy-locales/ru/auth.json";
import enAuth from "../../../../docs/legacy-locales/en/auth.json";
import ruAdmin from "../../../../docs/legacy-locales/ru/admin.json";
import enAdmin from "../../../../docs/legacy-locales/en/admin.json";
import ruLanding from "../../../../docs/legacy-locales/ru/landing.json";
import enLanding from "../../../../docs/legacy-locales/en/landing.json";
import ruAchievements from "../../../../docs/legacy-locales/ru/achievements.json";
import enAchievements from "../../../../docs/legacy-locales/en/achievements.json";

const packs = {
  ru: { common: ruCommon, room: ruRoom, chat: ruChat, player: ruPlayer, auth: ruAuth, admin: ruAdmin, landing: ruLanding, achievements: ruAchievements },
  en: { common: enCommon, room: enRoom, chat: enChat, player: enPlayer, auth: enAuth, admin: enAdmin, landing: enLanding, achievements: enAchievements },
} as const;

export type LegacyNamespace = keyof (typeof packs)["ru"];

export function legacyText(locale: "ru" | "en", namespace: LegacyNamespace, path: string): string | null {
  let current: unknown = packs[locale][namespace];
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : null;
}
