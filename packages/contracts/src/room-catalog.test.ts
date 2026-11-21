import { describe, expect, it } from "vitest";
import {
  roomCatalogFilterSchema,
  roomCatalogItemSchema,
  roomCatalogQuerySchema,
  roomCatalogResponseSchema,
  roomCategorySchema,
  roomCategorySelectionSchema,
} from "./room-catalog.js";

describe("roomCategorySchema", () => {
  it("accepts the four authoritative categories", () => {
    expect(roomCategorySchema.parse("film")).toBe("film");
    expect(roomCategorySchema.parse("music")).toBe("music");
    expect(roomCategorySchema.parse("vlog")).toBe("vlog");
    expect(roomCategorySchema.parse("other")).toBe("other");
  });

  it("rejects a category outside the closed set", () => {
    expect(roomCategorySchema.safeParse("podcast").success).toBe(false);
  });
});

describe("roomCategorySelectionSchema", () => {
  it("accepts auto and every concrete category", () => {
    for (const value of ["auto", "film", "music", "vlog", "other"]) {
      expect(roomCategorySelectionSchema.parse(value)).toBe(value);
    }
  });

  it("rejects an unknown selection", () => {
    expect(roomCategorySelectionSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("roomCatalogFilterSchema", () => {
  it("accepts exactly all, friends, film, music and vlog", () => {
    for (const value of ["all", "friends", "film", "music", "vlog"]) {
      expect(roomCatalogFilterSchema.parse(value)).toBe(value);
    }
  });

  it("rejects other as a directory filter", () => {
    expect(roomCatalogFilterSchema.safeParse("other").success).toBe(false);
  });
});

describe("roomCatalogQuerySchema", () => {
  it("defaults an absent filter to all with no cursor", () => {
    expect(roomCatalogQuerySchema.parse({})).toEqual({ filter: "all", cursor: undefined });
  });

  it("keeps an explicit filter and opaque cursor", () => {
    expect(roomCatalogQuerySchema.parse({ filter: "film", cursor: "opaque-42" })).toEqual({
      filter: "film",
      cursor: "opaque-42",
    });
  });

  it("rejects an unsupported filter", () => {
    expect(roomCatalogQuerySchema.safeParse({ filter: "other" }).success).toBe(false);
  });
});

describe("roomCatalogItemSchema", () => {
  const validItem = {
    id: "room-1",
    code: "7kq2mx",
    title: "Вечерний зал",
    hostId: "host-1",
    status: "live",
    isPublic: true,
    memberCount: 3,
    isFull: false,
    createdAt: "2026-11-21T12:00:00.000Z",
    category: "music",
    mediaPreview: {
      provider: "soundcloud",
      title: "Трек",
      thumbnailUrl: null,
    },
  };

  it("accepts a full item with a media preview", () => {
    expect(roomCatalogItemSchema.parse(validItem)).toEqual(validItem);
  });

  it("accepts a null media preview", () => {
    expect(roomCatalogItemSchema.parse({ ...validItem, mediaPreview: null }).mediaPreview).toBeNull();
  });

  it("requires the stable id and effective category", () => {
    const { id: _id, ...withoutId } = validItem;
    const { category: _category, ...withoutCategory } = validItem;
    expect(roomCatalogItemSchema.safeParse(withoutId).success).toBe(false);
    expect(roomCatalogItemSchema.safeParse(withoutCategory).success).toBe(false);
  });
});

describe("roomCatalogResponseSchema", () => {
  it("accepts a page with an opaque next cursor", () => {
    const response = {
      rooms: [],
      nextCursor: "opaque-42",
    };
    expect(roomCatalogResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts a terminal page with a null next cursor", () => {
    expect(roomCatalogResponseSchema.parse({ rooms: [], nextCursor: null }).nextCursor).toBeNull();
  });

  it("rejects a numeric next cursor", () => {
    expect(roomCatalogResponseSchema.safeParse({ rooms: [], nextCursor: 42 }).success).toBe(false);
  });
});
