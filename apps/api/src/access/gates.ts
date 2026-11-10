export interface BanRow {
  type: string;
  roomId: string | null;
  ownerId: string;
  liftedAt: Date | null;
  expiresAt: Date | null;
}

export function banBlocksJoin(
  bans: readonly BanRow[],
  room: { id: string; ownerId: string },
  now: Date,
): boolean {
  return bans.some((ban) => {
    if (ban.liftedAt) {
      return false;
    }
    if (ban.expiresAt && ban.expiresAt.getTime() <= now.getTime()) {
      return false;
    }
    if (ban.type === "blacklist" && ban.ownerId === room.ownerId) {
      return true;
    }
    return (ban.type === "permanent" || ban.type === "session") && ban.roomId === room.id;
  });
}
