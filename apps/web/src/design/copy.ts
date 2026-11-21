import type { Locale } from "@lume/contracts";
import type { MessageKey } from "../i18n/ru.js";

const ru = {
  search: "Найти видео или комнату",
  evening: "Добрый вечер",
  friendsWatching: "Друзья сейчас смотрят — можно зайти к ним",
  resume: "Продолжить",
  create: "Создать комнату",
  openRoom: "Открыть комнату",
  createHint: "Ссылка, друзья — и смотрим",
  join: "Войти по коду",
  joinHint: "Код комнаты из приглашения",
  enter: "Войти",
  rooms: "Открытые комнаты",
  all: "Все",
  friends: "Друзья",
  film: "Кино",
  music: "Музыка",
  online: "Друзья онлайн",
  level: "Уровень",
  reminders: "Напоминания",
  season: "Ваш сезон",
  settings: "Настройки",
  style: "Стиль",
  mode: "Тема",
  cinema: "Кинозал",
  gruvbox: "Gruvbox",
  dark: "Тёмная",
  light: "Светлая",
  system: "Системная",
  profile: "Профиль",
  shop: "Витрина Blink",
  notifications: "Уведомления",
  onboarding: "Добро пожаловать в lume",
  onboardingBody: "Создай зал или найди комнату. Друзья уже внутри.",
  missing: "Комната не найдена",
  offline: "Нет соединения",
  unavailable: "Видео недоступно",
  unavailableBody: "Источник не отвечает. Можно обновить ссылку или заменить видео.",
  refresh: "Обновить",
  replace: "Заменить видео",
  save: "Сохранить",
  signIn: "Представиться",
  name: "Как вас представить",
  telegram: "Войти через Telegram",
  report: "Пожаловаться",
  block: "Заблокировать",
  blacklist: "Чёрный список",
  leaderboard: "Таблица",
  voiceTest: "Проверить микрофон",
  defaults: "Права новичков",
  empty: "Пока пусто",
};

const en: typeof ru = {
  search: "Find a video or a room",
  evening: "Good evening",
  friendsWatching: "Friends are watching — you can join them",
  resume: "Continue",
  create: "Create a room",
  openRoom: "Open room",
  createHint: "A link, friends, and we watch",
  join: "Join with a code",
  joinHint: "The room code from your invitation",
  enter: "Join",
  rooms: "Open rooms",
  all: "All",
  friends: "Friends",
  film: "Film",
  music: "Music",
  online: "Friends online",
  level: "Level",
  reminders: "Reminders",
  season: "Your season",
  settings: "Settings",
  style: "Style",
  mode: "Theme",
  cinema: "Cinema",
  gruvbox: "Gruvbox",
  dark: "Dark",
  light: "Light",
  system: "System",
  profile: "Profile",
  shop: "Blink shop",
  notifications: "Notifications",
  onboarding: "Welcome to lume",
  onboardingBody: "Create a room or find one. Friends are already inside.",
  missing: "Room not found",
  offline: "You are offline",
  unavailable: "Video unavailable",
  unavailableBody: "The source is not responding. Refresh the link or replace the video.",
  refresh: "Refresh",
  replace: "Replace video",
  save: "Save",
  signIn: "Continue",
  name: "What should we call you",
  telegram: "Continue with Telegram",
  report: "Report",
  block: "Block",
  blacklist: "Blacklist",
  leaderboard: "Leaderboard",
  voiceTest: "Test microphone",
  defaults: "Newcomer permissions",
  empty: "Nothing here yet",
};

export const roomFilters = {
  film: /кино|film/i,
  music: /звук|music|концерт/i,
};

export function copy(locale: Locale) {
  return locale === "en" ? en : ru;
}

const permissionKeys: Record<string, MessageKey> = {
  canChat: "perm.canChat",
  canQueue: "perm.canQueue",
  canSpeak: "perm.canSpeak",
  canReact: "perm.canReact",
  canSeek: "perm.canSeek",
  canInvite: "perm.canInvite",
};

const permissionHintKeys: Record<string, MessageKey> = {
  canChat: "perm.canChatHint",
  canQueue: "perm.canQueueHint",
  canSpeak: "perm.canSpeakHint",
  canReact: "perm.canReactHint",
  canSeek: "perm.canSeekHint",
  canInvite: "perm.canInviteHint",
};

export function permissionLabel(key: string, t: (key: MessageKey) => string): string {
  const message = permissionKeys[key];
  return message ? t(message) : key;
}

export function permissionHint(key: string, t: (key: MessageKey) => string): string {
  const message = permissionHintKeys[key];
  return message ? t(message) : key;
}

export function viewersWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return count === 1 || (mod10 === 1 && mod100 !== 11) ? "смотрит" : "смотрят";
}
