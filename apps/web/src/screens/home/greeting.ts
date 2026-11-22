export type DayPart = "morning" | "day" | "evening" | "night";

/** 5–10 morning, 11–16 day, 17–22 evening, 23–4 night. Non-integer or out-of-range hours wrap into 0–23. */
export function dayPartOf(hour: number): DayPart {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 23) return "evening";
  return "night";
}
