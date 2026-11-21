import { describe, expect, it } from "vitest";
import { containSize } from "./contain.js";
import { resolveFlow } from "./reflow.js";
import { clamp, resizePair } from "./weights.js";

describe("room layout", () => {
  it("reflows at the documented 860 boundary", () => {
    expect(resolveFlow({ viewportWidth: 861, videoAspect: 16 / 9 })).toBe("side");
    expect(resolveFlow({ viewportWidth: 860, videoAspect: 16 / 9 })).toBe("side");
    expect(resolveFlow({ viewportWidth: 859, videoAspect: 16 / 9 })).toBe("stack");
    expect(resolveFlow({ viewportWidth: 1280, videoAspect: 16 / 9 })).toBe("side");
    expect(resolveFlow({ viewportWidth: 1280, videoAspect: 9 / 16 })).toBe("below");
    expect(resolveFlow({ viewportWidth: 700, videoAspect: 16 / 9 })).toBe("stack");
  });

  it("fits the stage inside the frame", () => {
    expect(containSize(1600, 900, 16 / 9)).toEqual({ width: 1600, height: 900 });
    expect(containSize(1600, 900, 9 / 16).height).toBe(900);
    expect(containSize(400, 800, 16 / 9)).toEqual({ width: 400, height: 225 });
    expect(containSize(0, 800, 16 / 9)).toEqual({ width: 0, height: 0 });
  });

  it("keeps both panels after a drag", () => {
    const next = resizePair(1.4, 0.8, 0.7);
    expect(next.a + next.b).toBeCloseTo(2.2);
    expect(next.a).toBeGreaterThan(next.b);
  });

  it("clamps the player ratio to the contract range", () => {
    expect(clamp(0.1, 0.35, 0.8)).toBe(0.35);
    expect(clamp(0.95, 0.35, 0.8)).toBe(0.8);
    expect(clamp(0.6, 0.35, 0.8)).toBe(0.6);
  });
});
