function minutesInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function parseClock(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return 0;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Quiet window may wrap past midnight, for example 22:00–08:00. */
export function inQuietHours(input: {
  now: Date;
  start: string;
  end: string;
  timeZone: string;
  enabled: boolean;
}): boolean {
  if (!input.enabled) {
    return false;
  }
  const current = minutesInZone(input.now, input.timeZone);
  const start = parseClock(input.start);
  const end = parseClock(input.end);
  if (start === end) {
    return false;
  }
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

export type DigestMode = "INSTANT" | "HOURLY" | "DAILY";

export function buildDigest(items: readonly { title: string; body: string; kind: string }[]): { title: string; body: string } {
  const first = items[0];
  if (!first) {
    return { title: "TeleRave digest", body: "" };
  }
  if (items.length === 1) {
    return { title: first.title, body: first.body };
  }
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([kind, count]) => `${kind}: ${count}`)
    .join(", ");
  const lines = items.slice(-5).map((item) => `- ${item.title}: ${item.body}`);
  return { title: `TeleRave digest: ${items.length} updates`, body: `${top}\n${lines.join("\n")}` };
}

export function nextDigestAt(input: {
  now: Date;
  digest: DigestMode;
  quiet: boolean;
}): Date {
  const next = new Date(input.now);
  if (input.digest === "DAILY" && !input.quiet) {
    next.setUTCHours(next.getUTCHours() + 24, 0, 0, 0);
    return next;
  }
  if (input.digest === "HOURLY" || input.quiet) {
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  }
  return new Date(input.now.getTime() + 15 * 60 * 1000);
}
