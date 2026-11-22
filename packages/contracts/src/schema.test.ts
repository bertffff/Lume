import { describe, expect, it } from "vitest";
import {
  clientEventSchema,
  defaultRoomLayout,
  joinRoomSchema,
  layoutAspectGroup,
  parseStoredLayouts,
  premiumEntitlementSchema,
  ROOM_LAYOUT_STORAGE_KEY,
  roomLayoutSchema,
  roomSchema,
  roomSummarySchema,
  serializeStoredLayouts,
  storeLayoutForAspect,
  telegramAuthPayloadSchema,
  themeSchema,
  userSchema,
  withLayoutPreset,
  withVideoAspect,
} from "./index.js";

const theme = {
  id: "ember",
  name: { ru: "Уголь", en: "Ember" },
  premium: false,
  colors: {
    bg: "#100e0c",
    surface: "#1a1612",
    panel: "#221c17",
    text: "#f6efe6",
    muted: "#a89888",
    accent: "#e3924a",
    accentText: "#1a1008",
    line: "rgba(243,226,206,0.14)",
    danger: "#e15b4c",
    ok: "#7dba6a",
  },
  radius: { sm: "8px", md: "14px", lg: "22px" },
  font: { sans: "sans-serif", display: "serif" },
};

describe("contracts", () => {
  it("parses a user, a room, and the default layout", () => {
    expect(roomLayoutSchema.parse(defaultRoomLayout).preset).toBe("theater");
    const user = userSchema.parse({
      id: "user_1",
      telegramId: "42",
      username: "anya",
      displayName: "Аня",
      locale: "ru",
      themeId: "ember",
    });
    expect(user.locale).toBe("ru");
    const room = roomSchema.parse({
      id: "room_1",
      slug: "vecher",
      title: "Вечерний зал",
      hostId: user.id,
      status: "live",
      layout: defaultRoomLayout,
      isPublic: false,
    });
    expect(room.layout.videoAspect).toBeGreaterThan(1);
  });

  it("accepts formatted input but requires canonical room codes in responses", () => {
    expect(joinRoomSchema.parse({ code: " 7KQ-2MX " })).toEqual({ code: "7kq2mx" });
    expect(joinRoomSchema.safeParse({ code: "7kq2mxzz" }).success).toBe(false);
    expect(roomSummarySchema.shape.code.safeParse("7KQ-2MX").success).toBe(false);
    expect(roomSummarySchema.shape.code.parse("7kq2mx")).toBe("7kq2mx");
  });

  it("rejects a layout that collapses the player share", () => {
    const parsed = roomLayoutSchema.safeParse({
      ...defaultRoomLayout,
      playerRatio: 0.1,
    });
    expect(parsed.success).toBe(false);
  });

  it("stores a layout per aspect group under the legacy key", () => {
    expect(ROOM_LAYOUT_STORAGE_KEY).toBe("telerave-room-layout-v1");
    expect(layoutAspectGroup(16 / 9)).toBe("horizontal");
    expect(layoutAspectGroup(9 / 16)).toBe("vertical");
    const vertical = withVideoAspect(withLayoutPreset(defaultRoomLayout, "immersive"), 9 / 16);
    const stored = storeLayoutForAspect(parseStoredLayouts(null), vertical);
    expect(stored.vertical.preset).toBe("immersive");
    expect(stored.horizontal.preset).toBe("theater");
    const reloaded = parseStoredLayouts(serializeStoredLayouts(stored));
    expect(reloaded.vertical.videoAspect).toBe(9 / 16);
    expect(withLayoutPreset(defaultRoomLayout, "enlarged").playerRatio).toBeGreaterThan(defaultRoomLayout.playerRatio);
  });

  it("parses theme, entitlement, telegram payload, and socket events", () => {
    expect(themeSchema.parse(theme).premium).toBe(false);
    expect(
      premiumEntitlementSchema.parse({
        id: "ent_1",
        userId: "user_1",
        sku: "theme.aurora",
        kind: "theme",
        active: true,
        expiresAt: null,
      }).sku,
    ).toBe("theme.aurora");
    expect(
      telegramAuthPayloadSchema.parse({
        authDate: 1_700_000_000,
        hash: "abc",
        user: { id: 42, first_name: "Аня", username: "anya" },
      }).user.id,
    ).toBe(42);
    const play = clientEventSchema.parse({
      event: "playback:play",
      payload: { roomId: "room_1", clientTimeMs: 10 },
    });
    expect(play.event).toBe("playback:play");
    const seek = clientEventSchema.parse({
      event: "playback:seek",
      payload: { roomId: "room_1", clientTimeMs: 10, positionMs: 5000 },
    });
    expect(seek.event).toBe("playback:seek");
    expect(
      clientEventSchema.safeParse({
        event: "playback:pause",
        payload: { roomId: "", clientTimeMs: 1 },
      }).success,
    ).toBe(false);
  });
});
