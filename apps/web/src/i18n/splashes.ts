import type { Locale } from "@lume/contracts";
import type { DayPart } from "../screens/home/greeting.js";

/**
 * Home-screen "splashes": short jokes shown next to the greeting, picked at random on each visit.
 * Add a line here and it appears; `when` limits it to one part of the day, `{name}` is the viewer's name.
 * People use nicknames, not only names: `{name}` always stands as a bare nominative word, so write
 * gender-neutral lines (no past-tense verbs agreeing with the name, no declension of it).
 * Keep them kind and short (≤ 40 characters reads best at the tilted size).
 */
export interface Splash {
  readonly text: string;
  readonly when?: DayPart;
}

const ru: readonly Splash[] = [
  { text: "Попкорн — за счёт зрителей!" },
  { text: "Без спойлеров, пожалуйста." },
  { text: "Пауза — не преступление." },
  { text: "Титры — тоже кино." },
  { text: "Тихо, тут смотрят." },
  { text: "Только не перематывай!" },
  { text: "{name}, плед при тебе?" },
  { text: "{name} на связи — можно начинать." },
  { text: "Свет приглушён, чат включён." },
  { text: "Всё синхронно. Почти." },
  { text: "Нажми «/» — найдёшь что угодно." },
  { text: "Ещё одну серию — и спать.", when: "evening" },
  { text: "Не спится? Нам тоже.", when: "night" },
  { text: "Кофе и кино с утра — норм.", when: "morning" },
];

const en: readonly Splash[] = [
  { text: "Popcorn is on the viewers!" },
  { text: "No spoilers, please." },
  { text: "Pausing is not a crime." },
  { text: "The credits are cinema too." },
  { text: "Quiet, people are watching." },
  { text: "Don't you dare skip ahead!" },
  { text: "{name}, is the blanket within reach?" },
  { text: "{name} is here — we can start." },
  { text: "Lights down, chat up." },
  { text: "Everything is in sync. Almost." },
  { text: "Press “/” to find anything." },
  { text: "One more episode, then bed.", when: "evening" },
  { text: "Can't sleep? Us neither.", when: "night" },
  { text: "Coffee and a film in the morning? Fine.", when: "morning" },
];

/** A name that is safe to splice into a sentence: one short word, no spaces, links or emoji soup. */
export function usableName(raw: string): string {
  const name = raw.trim();
  return /^[\p{L}\p{N}_.-]{1,18}$/u.test(name) && !/^\d+$/.test(name) ? name : "";
}

export const splashes: Readonly<Record<Locale, readonly Splash[]>> = { ru, en };

/**
 * Picks one splash for the current part of the day. Lines without `when` are always eligible;
 * `random` is injectable so tests and fixtures stay deterministic.
 */
export function pickSplash(locale: Locale, part: DayPart, firstName: string, random: () => number = Math.random): string {
  const pool = splashes[locale].filter((item) => item.when === undefined || item.when === part);
  const chosen = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] ?? splashes.ru[0];
  const name = usableName(firstName);
  // A line that addresses the viewer by name is meaningless for a guest: fall back to a neutral one.
  if (chosen && chosen.text.includes("{name}") && !name) {
    return pickSplash(locale, part, firstName, () => 0);
  }
  return (chosen?.text ?? "").replaceAll("{name}", name);
}
