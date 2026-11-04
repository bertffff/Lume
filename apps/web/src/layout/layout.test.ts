import { describe, expect, it } from "vitest";
import { containSize } from "./contain.js";
import { resolveFlow } from "./reflow.js";
import { resizePair } from "./weights.js";

describe("room layout", () => {
  it("reflows when the frame or the viewport changes shape", () => {
    expect(resolveFlow({ viewportWidth: 1280, videoAspect: 16 / 9 })).toBe("side");
    expect(resolveFlow({ viewportWidth: 1280, videoAspect: 9 / 16 })).toBe("below");
    expect(resolveFlow({ viewportWidth: 700, videoAspect: 16 / 9 })).toBe("stack");
  });

  it("fits the stage inside the frame", () => {
    expect(containSize(1600, 900, 16 / 9)).toEqual({ width: 1600, height: 900 });
    expect(containSize(1600, 900, 9 / 16).height).toBe(900);
    expect(containSize(400, 800, 16 / 9)).toEqual({ width: 400, height: 225 });
  });

  it("keeps both panels after a drag", () => {
    const next = resizePair(1.4, 0.8, 0.7);
    expect(next.a + next.b).toBeCloseTo(2.2);
    expect(next.a).toBeGreaterThan(next.b);
  });
});
