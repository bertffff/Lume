export type FlowMode = "side" | "below" | "stack";

/** Wide landscape video sits beside the panels. Portrait video sits above them. Narrow screens stack. */
export function resolveFlow(input: { viewportWidth: number; videoAspect: number }): FlowMode {
  if (input.viewportWidth < 860) {
    return "stack";
  }
  if (input.videoAspect < 1) {
    return "below";
  }
  return "side";
}
