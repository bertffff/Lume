import type { RoomCatalogItem } from "@lume/contracts";
import type { PrismaClient } from "@lume/db";
import type { CatalogPageInput } from "./catalog.js";

type Row = Omit<RoomCatalogItem, "createdAt" | "mediaPreview"> & {
  createdAt: Date;
  provider: string | null;
  mediaTitle: string | null;
  thumbnailUrl: string | null;
};

export async function prismaCatalog(prisma: PrismaClient, { viewerId, filter, after, take, now }: CatalogPageInput): Promise<RoomCatalogItem[]> {
  const category = filter === "all" || filter === "friends" ? null : filter;
  const rows = await prisma.$queryRaw<Row[]>`
    WITH contacts AS (
      SELECT CASE WHEN "requesterId" = ${viewerId} THEN "addresseeId" ELSE "requesterId" END AS id,
        bool_and(status = 'accepted') AS accepted, bool_or(status = 'blocked') AS blocked
      FROM "Friendship" WHERE "requesterId" = ${viewerId} OR "addresseeId" = ${viewerId}
      GROUP BY 1
    ), active_bans AS (
      SELECT * FROM "Ban" WHERE "liftedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
    ), page AS (
      SELECT room.* FROM "Room" room
      WHERE room."isPublic" AND room.status IN ('open', 'live')
        AND (${category}::"RoomCategory" IS NULL OR room.category = ${category}::"RoomCategory")
        AND (${after?.[0] ?? null}::timestamp IS NULL OR (room."createdAt", room.id) < (${after?.[0] ?? null}::timestamp, ${after?.[1] ?? null}))
        AND EXISTS (SELECT 1 FROM "RoomMember" m WHERE m."roomId" = room.id AND m."leftAt" IS NULL)
        AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.blocked AND c.id IN (room."hostId", room."ownerId"))
        AND NOT EXISTS (
          SELECT 1 FROM "RoomMember" m JOIN contacts c ON c.id = m."userId" AND c.blocked
          WHERE m."roomId" = room.id AND m.role = 'host' AND m."leftAt" IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM active_bans b WHERE b."userId" = ${viewerId} AND (
            (b.type = 'blacklist' AND b."ownerId" = room."ownerId") OR
            (b.type IN ('session', 'permanent') AND b."roomId" = room.id)
          )
        )
        AND (${filter !== "friends"} OR EXISTS (
          SELECT 1 FROM "RoomMember" m
          JOIN contacts c ON c.id = m."userId" AND c.accepted AND NOT c.blocked
          JOIN "User" u ON u.id = m."userId" AND u."isFriendsPublic" AND u."deletedAt" IS NULL
          WHERE m."roomId" = room.id AND m."leftAt" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM active_bans b WHERE b."userId" = m."userId" AND (
                (b.type = 'blacklist' AND b."ownerId" = room."ownerId") OR
                (b.type IN ('session', 'permanent') AND b."roomId" = room.id)
              )
            )
        ))
      ORDER BY room."createdAt" DESC, room.id DESC LIMIT ${take}
    )
    SELECT page.id, page.slug AS code, page.title, page."hostId", page.status, page."isPublic", page."createdAt", page.category,
      seats.count AS "memberCount", seats.count >= page."maxMembers" AS "isFull",
      media.provider, media.title AS "mediaTitle", media.thumbnail AS "thumbnailUrl"
    FROM page LEFT JOIN "QueueItem" media ON media.id = page."nowPlayingId" AND media."roomId" = page.id
    CROSS JOIN LATERAL (
      SELECT count(*)::int FROM "RoomMember" m WHERE m."roomId" = page.id AND m."leftAt" IS NULL
    ) seats
    ORDER BY page."createdAt" DESC, page.id DESC
  `;
  return rows.map(({ createdAt, provider, mediaTitle, thumbnailUrl, ...room }) => ({
    ...room,
    createdAt: createdAt.toISOString(),
    mediaPreview: provider && mediaTitle ? { provider, title: mediaTitle, thumbnailUrl } : null,
  }));
}
