export interface ClockSample {
  offsetMs: number;
  rttMs: number;
}

/** NTP offset with the server send time used for both t2 and t3. */
export function clockSample(t1: number, t2: number, t4: number): ClockSample {
  return {
    offsetMs: ((t2 - t1) + (t2 - t4)) / 2,
    rttMs: t4 - t1,
  };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function pushWindow(window: readonly number[], value: number, max = 10): number[] {
  const next = [...window, value];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function smoothRtt(previous: number, next: number): number {
  if (previous === 0) {
    return next;
  }
  return (previous * 9 + next) / 10;
}
