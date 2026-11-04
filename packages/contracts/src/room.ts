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
