import { z } from "zod";

export const panelIdSchema = z.enum(["player", "chat", "voice", "queue"]);
export type PanelId = z.infer<typeof panelIdSchema>;

export const sidePanelIdSchema = z.enum(["chat", "voice", "queue"]);
export type SidePanelId = z.infer<typeof sidePanelIdSchema>;

const weightSchema = z.number().positive();

export const roomLayoutSchema = z.object({
  version: z.literal(1),
  preset: z.enum(["theater", "stack", "custom"]),
  playerRatio: z.number().min(0.35).max(0.8),
  sideWeights: z.object({
    chat: weightSchema,
    voice: weightSchema,
    queue: weightSchema,
  }),
  collapsed: z.object({
    chat: z.boolean(),
    voice: z.boolean(),
    queue: z.boolean(),
  }),
  /** Width divided by height. 16:9 is about 1.78, 9:16 is about 0.56. */
  videoAspect: z.number().positive(),
});

export type RoomLayout = z.infer<typeof roomLayoutSchema>;

export const defaultRoomLayout: RoomLayout = {
  version: 1,
  preset: "theater",
  playerRatio: 0.66,
  sideWeights: { chat: 1.4, voice: 0.8, queue: 1 },
  collapsed: { chat: false, voice: false, queue: false },
  videoAspect: 16 / 9,
};
