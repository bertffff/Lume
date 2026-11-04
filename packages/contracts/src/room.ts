import { z } from "zod";
import { roomLayoutSchema } from "./layout.js";

export const roomStatusSchema = z.enum(["open", "live", "ended"]);
export type RoomStatus = z.infer<typeof roomStatusSchema>;

export const roomSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  hostId: z.string().min(1),
  status: roomStatusSchema,
  layout: roomLayoutSchema,
  isPublic: z.boolean(),
});

export type Room = z.infer<typeof roomSchema>;

export const roomSummarySchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1).max(16),
  title: z.string().min(1).max(120),
  hostId: z.string().min(1),
  status: roomStatusSchema,
  isPublic: z.boolean(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});

export type RoomSummary = z.infer<typeof roomSummarySchema>;

export const createRoomSchema = z.object({
  title: z.string().trim().min(1).max(120),
  isPublic: z.boolean().optional(),
});

export const joinRoomSchema = z.object({
  code: z.string().trim().min(1).max(16),
});
