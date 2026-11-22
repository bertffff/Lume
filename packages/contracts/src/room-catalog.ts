import { z } from "zod";
import { roomSummarySchema } from "./room.js";
import { roomCategorySchema } from "./room-category.js";

export * from "./room-category.js";

/**
 * Directory tabs. `other` is intentionally not a tab: uncategorised rooms are
 * still reachable through `all`, and the filter set stays stable for clients.
 */
export const roomCatalogFilterSchema = z.enum(["all", "friends", "film", "music", "vlog"]);
export type RoomCatalogFilter = z.infer<typeof roomCatalogFilterSchema>;

/** Decoded query for `GET /rooms/catalog`. `cursor` is an opaque string. */
export const roomCatalogQuerySchema = z.object({
  filter: roomCatalogFilterSchema.default("all"),
  cursor: z.string().min(1).max(512).optional(),
});
export type RoomCatalogQuery = z.infer<typeof roomCatalogQuerySchema>;

/** Nullable preview of the room's current video; never a stub when empty. */
export const roomCatalogMediaPreviewSchema = z.object({
  provider: z.string().min(1),
  title: z.string().min(1),
  thumbnailUrl: z.string().nullable(),
});
export type RoomCatalogMediaPreview = z.infer<typeof roomCatalogMediaPreviewSchema>;

/**
 * One directory row: the existing room summary fields plus the effective
 * category and a nullable media preview. `id` is the stable room identifier
 * used for de-duplication and keyset pagination.
 */
export const roomCatalogItemSchema = roomSummarySchema.extend({
  category: roomCategorySchema,
  isFull: z.boolean(),
  mediaPreview: roomCatalogMediaPreviewSchema.nullable(),
});
export type RoomCatalogItem = z.infer<typeof roomCatalogItemSchema>;

/**
 * Paginated directory response. A null `nextCursor` terminates the page
 * sequence; a non-null value is passed back verbatim as the next query cursor.
 */
export const roomCatalogResponseSchema = z.object({
  rooms: z.array(roomCatalogItemSchema),
  nextCursor: z.string().nullable(),
});
export type RoomCatalogResponse = z.infer<typeof roomCatalogResponseSchema>;
