import type { PlayerAdapter } from "@lume/contracts";
import { createEmbedBridgeAdapter } from "./embed-bridge.js";

export function createVkAdapter(externalId: string, mount: HTMLElement, parentHost: string): PlayerAdapter {
  return createEmbedBridgeAdapter("vk", externalId, mount, parentHost);
}
