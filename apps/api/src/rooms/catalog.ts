import type { RoomCatalogFilter, RoomCatalogItem } from "@lume/contracts";
import { z } from "zod";

const pageSize = 30;
const cursorSchema = z.tuple([z.string().datetime(), z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)]);
type CatalogCursor = z.infer<typeof cursorSchema>;

export interface CatalogPageInput {
  viewerId: string | null;
  filter: RoomCatalogFilter;
  after: CatalogCursor | null;
  take: number;
  now: Date;
}

export function catalogCursor(raw: string | undefined): CatalogCursor | null {
  if (raw === undefined) return null;
  try {
    const decoded = Buffer.from(raw, "base64url");
    if (decoded.toString("base64url") !== raw) return null;
    const result = cursorSchema.parse(JSON.parse(decoded.toString("utf8")));
    return !result[0].startsWith("0000-") && new Date(result[0]).toISOString() === result[0] ? result : null;
  } catch {
    return null;
  }
}

export const catalogFetchSize = pageSize + 1;

export function catalogResponse(rows: RoomCatalogItem[]) {
  const rooms = rows.slice(0, pageSize);
  const last = rooms.at(-1);
  const nextCursor = rows.length > pageSize && last
    ? Buffer.from(JSON.stringify([last.createdAt, last.id])).toString("base64url")
    : null;
  return { rooms, nextCursor };
}
