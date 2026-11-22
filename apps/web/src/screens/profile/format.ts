/** 4_440 s → "1 ч 14 мин"; minutes-only under an hour; seconds only under a minute. Keys come from the dictionaries. */
export function formatDuration(
  seconds: number,
  t: (key: "time.hoursMinutes" | "time.minutesSeconds" | "time.seconds", params?: Record<string, number>) => string,
): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return t("time.hoursMinutes", { hours, minutes });
  if (minutes > 0) return t("time.minutesSeconds", { minutes, seconds: safe % 60 });
  return t("time.seconds", { seconds: safe });
}
