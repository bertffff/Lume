import { test } from "@playwright/test";

const names = new Map<string, string>();
let counter = 0;

/**
 * Display names are the identity key for dev sign-in, so shared names make
 * parallel specs share one user. Each test gets its own stable suffix.
 */
export function uniqueName(base: string): string {
  const info = test.info();
  const key = `${info.testId}:${base}`;
  const existing = names.get(key);
  if (existing) return existing;
  counter += 1;
  const name = `${base} ${info.workerIndex}${counter}`;
  names.set(key, name);
  return name;
}
