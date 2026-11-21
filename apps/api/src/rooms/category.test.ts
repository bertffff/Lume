import { describe, expect, it } from "vitest";
import { classifyRoomCategory, resolveEffectiveCategory } from "./category.js";

describe("classifyRoomCategory — trusted metadata precedence", () => {
  it("uses a trusted metadata category when it is one of the closed set", () => {
    expect(classifyRoomCategory({ category: "film", title: "", channel: "", source: "youtube" })).toBe("film");
    expect(classifyRoomCategory({ category: "music", title: "", channel: "", source: "youtube" })).toBe("music");
    expect(classifyRoomCategory({ category: "vlog", title: "", channel: "", source: "youtube" })).toBe("vlog");
  });

  it("lets an explicit other from metadata beat music keywords", () => {
    expect(
      classifyRoomCategory({
        category: "other",
        title: "Музыка и песни — official music video",
        channel: "Music Channel",
        source: "soundcloud",
      }),
    ).toBe("other");
  });

  it("falls back to other when source metadata is unknown and nothing else is decisive", () => {
    expect(classifyRoomCategory({ source: "some-unknown-source", title: "", channel: "" })).toBe("other");
    expect(classifyRoomCategory({})).toBe("other");
  });

  it("does not treat an unrecognized metadata category string as trusted evidence", () => {
    expect(classifyRoomCategory({ category: "sport", title: "Хоккей", channel: "", source: "youtube" })).toBe("other");
  });
});

describe("classifyRoomCategory — deterministic title and channel signals", () => {
  it("classifies film from unambiguous title keywords", () => {
    expect(classifyRoomCategory({ title: "Смотрим фильм целиком", source: "youtube" })).toBe("film");
  });

  it("classifies music from unambiguous channel keywords", () => {
    expect(classifyRoomCategory({ channel: "Музыкальный канал", source: "youtube" })).toBe("music");
  });

  it("classifies vlog from unambiguous title keywords", () => {
    expect(classifyRoomCategory({ title: "Мой влог: день из жизни", source: "vk" })).toBe("vlog");
  });

  it("returns other when keywords from two categories compete", () => {
    expect(classifyRoomCategory({ title: "фильм и музыка", source: "youtube" })).toBe("other");
  });

  it("does not infer a category from youtube, vk or rutube alone", () => {
    for (const source of ["youtube", "vk", "rutube"]) {
      expect(classifyRoomCategory({ title: "Обзор", channel: "Канал", source })).toBe("other");
    }
  });

  it("uses a decisive music-only source in absence of other signals", () => {
    expect(classifyRoomCategory({ title: "", channel: "", source: "soundcloud" })).toBe("music");
    expect(classifyRoomCategory({ title: "", channel: "", source: "bandcamp" })).toBe("music");
  });
});

describe("resolveEffectiveCategory — explicit selection and auto", () => {
  const musicVideo = { title: "Новая песня", channel: "Музыка", source: "soundcloud" };

  it("lets an explicit other selection beat music metadata", () => {
    expect(resolveEffectiveCategory("other", musicVideo)).toBe("other");
  });

  it("makes auto follow changes of the current video", () => {
    expect(resolveEffectiveCategory("auto", musicVideo)).toBe("music");
    expect(resolveEffectiveCategory("auto", { title: "Смотрим фильм", channel: "", source: "youtube" })).toBe("film");
  });

  it("keeps an explicit concrete selection regardless of metadata", () => {
    expect(resolveEffectiveCategory("vlog", musicVideo)).toBe("vlog");
    expect(resolveEffectiveCategory("film", { ...musicVideo, category: "music" })).toBe("film");
  });
});

describe("classifier purity", () => {
  it("does not mutate the metadata it classifies", () => {
    const metadata = { category: "music", title: "Песня", channel: "", source: "youtube" };
    const snapshot = { ...metadata };
    expect(classifyRoomCategory(metadata)).toBe("music");
    expect(metadata).toEqual(snapshot);
  });
});
