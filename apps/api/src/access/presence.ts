import type { PrismaClient } from "@lume/db";
import { banBlocksJoin, type BanRow } from "./gates.js";

interface PresenceSeat {
  roomId: string;
  leftAt: Date | null;
  room: { title: string; isPublic: boolean; status: "open" | "live" | "ended" };
}

const publicRoomStatuses: PresenceSeat["room"]["status"][] = ["open", "live"];

/** For anonymous room eligibility only; do not use to associate a user with a room. */
export const publicRoomPresenceWhere = { isPublic: true, status: { in: publicRoomStatuses } };

type PublicRoomPresence = { roomId: string; roomTitle: string };

/** Room-only projection; does not authorize associating the room with a person. */
export function visiblePublicRoom(seat: PresenceSeat | null): PublicRoomPresence | null {
  if (!seat || seat.leftAt !== null || seat.room.isPublic !== true || !publicRoomStatuses.includes(seat.room.status)) {
    return null;
  }
  return { roomId: seat.roomId, roomTitle: seat.room.title };
}

export async function activePresenceViewer(prisma: PrismaClient, viewerId: string | null): Promise<boolean> {
  return viewerId !== null && (await prisma.user.count({ where: { id: viewerId, deletedAt: null } })) === 1;
}

/** Social routes only: caller must authorize the active viewer and every subject before lookup. */
export async function publicPresenceForAuthorizedSubjects(
  prisma: PrismaClient,
  viewerId: string,
  subjectIds: readonly string[],
): Promise<ReadonlyMap<string, PublicRoomPresence>> {
  if (subjectIds.length === 0) return new Map();

  // Select the latest active seat first. Filtering private/ended rooms in SQL
  // here would incorrectly disclose an older public seat.
  const seats = await prisma.roomMember.findMany({
    where: { userId: { in: [...subjectIds] }, leftAt: null },
    select: { userId: true, roomId: true, leftAt: true, room: { select: { title: true, isPublic: true, status: true, ownerId: true } } },
    distinct: ["userId"],
    orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
  });
  const candidates = seats.flatMap((seat) => {
    const activity = visiblePublicRoom(seat);
    return activity ? [{ activity, userId: seat.userId, room: { id: seat.roomId, ownerId: seat.room.ownerId } }] : [];
  });
  if (candidates.length === 0) return new Map();

  const now = new Date();
  const bans = await prisma.ban.findMany({
    where: {
      userId: { in: [...new Set([viewerId, ...candidates.map(({ userId }) => userId)])] },
      liftedAt: null,
      OR: [
        { type: { in: ["session", "permanent"] }, roomId: { in: [...new Set(candidates.map(({ room }) => room.id))] } },
        { type: "blacklist", ownerId: { in: [...new Set(candidates.map(({ room }) => room.ownerId))] } },
      ],
    },
    select: { userId: true, type: true, roomId: true, ownerId: true, liftedAt: true, expiresAt: true },
  });
  const bansByUser = new Map<string, BanRow[]>();
  for (const ban of bans) {
    const userBans = bansByUser.get(ban.userId);
    if (userBans) userBans.push(ban);
    else bansByUser.set(ban.userId, [ban]);
  }
  const viewerBans = bansByUser.get(viewerId) ?? [];
  const visible = candidates.filter(({ userId, room }) =>
    !banBlocksJoin(viewerBans, room, now) && !banBlocksJoin(bansByUser.get(userId) ?? [], room, now));
  return new Map(visible.map(({ userId, activity }) => [userId, activity]));
}

export async function profilePresenceFor(
  prisma: PrismaClient,
  viewerId: string | null,
  target: { id: string; isFriendsPublic: boolean },
) {
  if (!viewerId || (viewerId !== target.id && !target.isFriendsPublic) || !(await activePresenceViewer(prisma, viewerId))) {
    return null;
  }
  if (viewerId !== target.id) {
    const edges = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: viewerId, addresseeId: target.id }, { requesterId: target.id, addresseeId: viewerId }] },
      select: { status: true },
    });
    if (edges.some((edge) => edge.status !== "accepted") || edges.length === 0) return null;
  }
  const presence = await publicPresenceForAuthorizedSubjects(prisma, viewerId, [target.id]);
  return presence.get(target.id) ?? null;
}
