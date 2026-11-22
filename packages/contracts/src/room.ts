import { z } from "zod";
import { roomLayoutSchema } from "./layout.js";
import { parseRoomCode } from "./room-code.js";
import { roomCategorySelectionSchema } from "./room-category.js";

const canonicalRoomCodeSchema = z.string().refine((code) => parseRoomCode(code) === code, "Invalid room code");

export const roomStatusSchema = z.enum(["open", "live", "ended"]);
export type RoomStatus = z.infer<typeof roomStatusSchema>;

export const roomSchema = z.object({
  id: z.string().min(1),
  slug: canonicalRoomCodeSchema,
  title: z.string().min(1).max(120),
  hostId: z.string().min(1),
  status: roomStatusSchema,
  layout: roomLayoutSchema,
  isPublic: z.boolean(),
});

export type Room = z.infer<typeof roomSchema>;

export const roomSummarySchema = z.object({
  id: z.string().min(1),
  code: canonicalRoomCodeSchema,
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
  preset: z.enum(["cinema", "party", "closed", "moderated"]).optional(),
  categorySelection: roomCategorySelectionSchema.optional(),
  defaults: z.object({
    canChat: z.boolean(), canQueue: z.boolean(), canSpeak: z.boolean(),
    canReact: z.boolean(), canSeek: z.boolean(), canInvite: z.boolean(),
  }).optional(),
});

export const joinRoomSchema = z.object({
  code: z.string().transform((value, ctx) => {
    const code = parseRoomCode(value);
    if (code === null) {
      ctx.addIssue({ code: "custom", message: "Invalid room code" });
      return z.NEVER;
    }
    return code;
  }),
});
