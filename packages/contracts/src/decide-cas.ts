/** Same rule as the Redis Lua script in apps/realtime: empty expected version creates, otherwise versions must match. */
export function decideCas(storedVersion: number | null, expectedVersion: string): "ok" | "conflict" {
  if (storedVersion === null) {
    return expectedVersion === "" ? "ok" : "conflict";
  }
  return String(storedVersion) === expectedVersion ? "ok" : "conflict";
}
