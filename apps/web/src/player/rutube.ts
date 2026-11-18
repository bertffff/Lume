import type { PlayerAdapter } from "@lume/contracts";
import { createEmbedBridgeAdapter } from "./embed-bridge.js";

export function createRutubeAdapter(externalId: string, mount: HTMLElement, parentHost: string): PlayerAdapter {
  return createEmbedBridgeAdapter("rutube", externalId, mount, parentHost);
}
