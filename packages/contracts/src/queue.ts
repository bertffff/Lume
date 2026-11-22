import { z } from "zod";
import { embedProviderSchema } from "./embed.js";

export const queueItemSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  url: z.string().min(1),
  provider: embedProviderSchema,
  externalId: z.string().min(1),
  title: z.string().min(1),
  thumbnailUrl: z.string().min(1).nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  position: z.number().int().nonnegative(),
  addedById: z.string().min(1),
  played: z.boolean(),
});

export type QueueItem = z.infer<typeof queueItemSchema>;

export const queueAddSchema = z.object({
  roomId: z.string().min(1),
  url: z.string().trim().min(1).max(2000),
  title: z.string().trim().max(200).optional(),
});

export const queueNextSchema = z.object({
  roomId: z.string().min(1),
});

export const queueItemActionSchema = z.object({
  roomId: z.string().min(1),
  itemId: z.string().min(1),
});

export const queueMoveSchema = queueItemActionSchema.extend({
  direction: z.enum(["up", "down"]),
});
