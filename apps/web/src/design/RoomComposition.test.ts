import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("room composition boundaries", () => {
  it("keeps a single player and dock, without the old mobile mirror or competing add form", () => {
    const stage = source("./RoomStage.tsx");
    expect(stage.match(/<PlayerPanel\b/g)).toHaveLength(1);
    expect(stage.match(/<SessionDock\b/g)).toHaveLength(1);
    expect(stage.match(/<RoomHeader\b/g)).toHaveLength(1);
    expect(stage).not.toContain("mobile-sheet-chat");
    expect(source("../layout/panels/PlayerPanel.tsx")).not.toContain("player-empty-url");
  });

  it("keeps diagnostics and moderation out of the stage and puts section tabs in the dock", () => {
    const stage = source("./RoomStage.tsx");
    expect(stage).not.toContain("voice-ice");
    expect(stage).not.toContain("room-defaults");
    expect(source("./SessionDock.tsx")).toContain('role="tablist"');
  });
});
