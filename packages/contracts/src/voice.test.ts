import { describe, expect, it } from "vitest";
import { classifyNetworkPreflight, sharedVoiceSeconds, voiceSessionStartedAt } from "./voice.js";

describe("voice preflight network score", () => {
  it("classifies slow, fair, and good connections", () => {
    expect(classifyNetworkPreflight({ effectiveType: "2g" })).toBe("poor");
    expect(classifyNetworkPreflight({ saveData: true })).toBe("poor");
    expect(classifyNetworkPreflight({ rtt: 500 })).toBe("poor");
    expect(classifyNetworkPreflight({ effectiveType: "3g", downlink: 5 })).toBe("fair");
    expect(classifyNetworkPreflight({ downlink: 0.8 })).toBe("poor");
    expect(classifyNetworkPreflight({ downlink: 1.5 })).toBe("fair");
    expect(classifyNetworkPreflight({ rtt: 200 })).toBe("fair");
    expect(classifyNetworkPreflight({ effectiveType: "4g", downlink: 10, rtt: 50 })).toBe("good");
  });

  it("derives one shared session clock from the earliest voice join", () => {
    const members = [{ joinedAtMs: 5_000 }, { joinedAtMs: 2_000 }, { joinedAtMs: 9_000 }];
    expect(voiceSessionStartedAt(members)).toBe(2_000);
    expect(sharedVoiceSeconds(members, 10_000)).toBe(8);
    expect(voiceSessionStartedAt([])).toBeNull();
    expect(sharedVoiceSeconds([], 10_000)).toBe(0);
  });
});
