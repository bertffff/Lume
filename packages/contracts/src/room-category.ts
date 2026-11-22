import { z } from "zod";

export const roomCategorySchema = z.enum(["film", "music", "vlog", "other"]);
export type RoomCategory = z.infer<typeof roomCategorySchema>;

export const roomCategorySelectionSchema = z.enum(["auto", ...roomCategorySchema.options]);
export type RoomCategorySelection = z.infer<typeof roomCategorySelectionSchema>;

export const roomCategorySettingsSchema = z.object({
  category: roomCategorySchema,
  categorySelection: roomCategorySelectionSchema,
});
