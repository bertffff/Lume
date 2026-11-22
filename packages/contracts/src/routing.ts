/** FNV-1a 32-bit. Stable across processes, used only to pick a replica index. */
export function roomHash(roomId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < roomId.length; index += 1) {
    hash ^= roomId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Room-hash routing: replica index = hash(roomId) % replicaCount.
 * Redis remains the source of truth, so any replica can serve a room.
 * The index is the preferred writer when REALTIME_ENFORCE_ROOM_OWNER is on.
 */
export function replicaForRoom(roomId: string, replicaCount: number): number {
  if (!Number.isInteger(replicaCount) || replicaCount < 1) {
    throw new Error("replicaCount must be a positive integer");
  }
  return roomHash(roomId) % replicaCount;
}

/** Null when this replica owns the room. Otherwise the index that does. */
export function foreignOwnerIndex(
  roomId: string,
  replicaIndex: number,
  replicaCount: number,
): number | null {
  const owner = replicaForRoom(roomId, replicaCount);
  return owner === replicaIndex ? null : owner;
}
