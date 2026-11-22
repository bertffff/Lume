export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resizePair(
  a: number,
  b: number,
  fraction: number,
  minFraction = 0.18,
): { a: number; b: number } {
  const sum = a + b;
  const safe = clamp(fraction, minFraction, 1 - minFraction);
  return { a: sum * safe, b: sum * (1 - safe) };
}
