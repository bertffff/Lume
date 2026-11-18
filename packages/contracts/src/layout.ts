import { z } from "zod";

export const panelIdSchema = z.enum(["player", "chat", "voice", "queue"]);
export type PanelId = z.infer<typeof panelIdSchema>;

export const sidePanelIdSchema = z.enum(["chat", "voice", "queue"]);
export type SidePanelId = z.infer<typeof sidePanelIdSchema>;

const weightSchema = z.number().positive();

export const roomLayoutSchema = z.object({
  version: z.literal(1),
  preset: z.enum(["theater", "enlarged", "immersive", "stack", "custom"]),
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

export const ROOM_LAYOUT_STORAGE_KEY = "telerave-room-layout-v1";

export type LayoutAspectGroup = "horizontal" | "vertical";
export type RoomLayoutPreset = RoomLayout["preset"];

export interface StoredRoomLayouts {
  horizontal: RoomLayout;
  vertical: RoomLayout;
}

/** A wide frame is horizontal; a tall or square one is vertical. */
export function layoutAspectGroup(aspect: number): LayoutAspectGroup {
  return aspect < 1 ? "vertical" : "horizontal";
}

export function withLayoutPreset(layout: RoomLayout, preset: RoomLayoutPreset): RoomLayout {
  if (preset === "enlarged") {
    return { ...layout, preset, playerRatio: 0.8, collapsed: { ...layout.collapsed, voice: true } };
  }
  if (preset === "immersive") {
    return { ...layout, preset, playerRatio: 0.8, collapsed: { chat: true, voice: true, queue: true } };
  }
  if (preset === "theater") {
    return { ...layout, preset, playerRatio: defaultRoomLayout.playerRatio, collapsed: { ...defaultRoomLayout.collapsed } };
  }
  return { ...layout, preset };
}

export function withVideoAspect(layout: RoomLayout, aspect: number): RoomLayout {
  return { ...layout, videoAspect: aspect };
}

export function parseStoredLayouts(raw: string | null): StoredRoomLayouts {
  const fallback: StoredRoomLayouts = {
    horizontal: defaultRoomLayout,
    vertical: { ...defaultRoomLayout, videoAspect: 9 / 16 },
  };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRoomLayouts>;
    const horizontal = roomLayoutSchema.safeParse(parsed.horizontal);
    const vertical = roomLayoutSchema.safeParse(parsed.vertical);
    return {
      horizontal: horizontal.success ? horizontal.data : fallback.horizontal,
      vertical: vertical.success ? vertical.data : fallback.vertical,
    };
  } catch {
    return fallback;
  }
}

export function serializeStoredLayouts(layouts: StoredRoomLayouts): string {
  return JSON.stringify(layouts);
}

export function storeLayoutForAspect(layouts: StoredRoomLayouts, layout: RoomLayout): StoredRoomLayouts {
  return { ...layouts, [layoutAspectGroup(layout.videoAspect)]: layout };
}

