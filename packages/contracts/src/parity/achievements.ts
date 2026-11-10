export const partyAchievements = [
  { key: "first_party", titleRu: "🎉 Первая вечеринка", titleEn: "First party", descriptionRu: "Присоединитесь к первой совместной комнате просмотра", descriptionEn: "Join your first watch party", icon: "🎉", xpReward: 50, condition: "totalParties >= 1" },
  { key: "party_animal", titleRu: "🦁 Тусовщик", titleEn: "Party animal", descriptionRu: "Проведите 10 совместных просмотров", descriptionEn: "Join 10 watch parties", icon: "🦁", xpReward: 200, condition: "totalParties >= 10" },
  { key: "party_legend", titleRu: "👑 Легенда вечеринок", titleEn: "Party legend", descriptionRu: "Проведите 100 совместных просмотров", descriptionEn: "Join 100 watch parties", icon: "👑", xpReward: 1000, condition: "totalParties >= 100" },
  { key: "night_watch", titleRu: "🌙 Ночной дозор", titleEn: "Night watch", descriptionRu: "Смотрите видео после полуночи", descriptionEn: "Watch after midnight", icon: "🌙", xpReward: 100, condition: "watchAfterMidnight" },
  { key: "marathon", titleRu: "🏃 Марафонец", titleEn: "Marathon", descriptionRu: "Проведите 5 часов за совместным просмотром", descriptionEn: "Watch together for 5 hours", icon: "🏃", xpReward: 300, condition: "totalWatchTime >= 18000" },
  { key: "binge_watcher", titleRu: "📺 Запойный зритель", titleEn: "Binge watcher", descriptionRu: "Проведите 24 часа за совместным просмотром", descriptionEn: "Watch together for 24 hours", icon: "📺", xpReward: 500, condition: "totalWatchTime >= 86400" },
  { key: "social_butterfly", titleRu: "🦋 Душа компании", titleEn: "Social butterfly", descriptionRu: "Отправьте 100 сообщений в чатах", descriptionEn: "Send 100 chat messages", icon: "🦋", xpReward: 150, condition: "totalMessages >= 100" },
  { key: "host_master", titleRu: "🎬 Мастер хост", titleEn: "Host master", descriptionRu: "Создайте 10 комнат", descriptionEn: "Create 10 rooms", icon: "🎬", xpReward: 250, condition: "roomsCreated >= 10" },
  { key: "early_bird", titleRu: "🐦 Ранняя пташка", titleEn: "Early bird", descriptionRu: "Начните просмотр до 7 утра", descriptionEn: "Start a watch before 7", icon: "🐦", xpReward: 100, condition: "watchBeforeSeven" },
  { key: "reaction_king", titleRu: "😂 Король реакций", titleEn: "Reaction king", descriptionRu: "Отправьте 50 реакций", descriptionEn: "Send 50 reactions", icon: "😂", xpReward: 100, condition: "totalReactions >= 50" },
] as const;

export type PartyAchievementKey = (typeof partyAchievements)[number]["key"];

export interface AchievementProgress {
  totalParties: number;
  totalWatchTime: number;
  totalMessages: number;
  roomsCreated: number;
  totalReactions: number;
  /** Hour 0–23 in the user's timezone. */
  hourInZone: number;
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 500) + 1;
}

export function nextLevelXp(xp: number): number {
  return levelFromXp(xp) * 500;
}

export function earnedAchievementKeys(progress: AchievementProgress): PartyAchievementKey[] {
  const keys: PartyAchievementKey[] = [];
  if (progress.totalParties >= 1) keys.push("first_party");
  if (progress.totalParties >= 10) keys.push("party_animal");
  if (progress.totalParties >= 100) keys.push("party_legend");
  if (progress.hourInZone >= 0 && progress.hourInZone < 5) keys.push("night_watch");
  if (progress.totalWatchTime >= 18_000) keys.push("marathon");
  if (progress.totalWatchTime >= 86_400) keys.push("binge_watcher");
  if (progress.totalMessages >= 100) keys.push("social_butterfly");
  if (progress.roomsCreated >= 10) keys.push("host_master");
  if (progress.hourInZone >= 5 && progress.hourInZone < 7) keys.push("early_bird");
  if (progress.totalReactions >= 50) keys.push("reaction_king");
  return keys;
}

export function xpForKeys(keys: readonly string[]): number {
  return keys.reduce((sum, key) => {
    const found = partyAchievements.find((item) => item.key === key);
    return sum + (found?.xpReward ?? 0);
  }, 0);
}
