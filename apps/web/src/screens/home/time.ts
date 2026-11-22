/** 4_364_000 ms → "1:12:44"; under an hour → "12:44". Negative or non-finite input is treated as zero. */
export function formatClock(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Watch-time score is seconds-based (see dayScore): 0 none, then four steps up to ~3 h. */
export function heatLevel(score: number): 0 | 1 | 2 | 3 | 4 {
  if (!(score > 0)) return 0;
  if (score < 1800) return 1;
  if (score < 5400) return 2;
  if (score < 10800) return 3;
  return 4;
}

/** Monday-based weekday (0–6) of an ISO day; unknown formats start the grid at the top. */
export function weekdayOf(day: string): number {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? 0 : (date.getUTCDay() + 6) % 7;
}
