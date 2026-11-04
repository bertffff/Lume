import type { EmbedProvider, PlayerAdapter, PlayerObservation } from "@lume/contracts";
import { embedSrc } from "@lume/contracts";
import { createObserver, fillMount } from "./events.js";

/**
 * VK and Rutube do not publish a stable remote-control API.
 * The iframe is shown, and play/pause/seek also move a local clock so sync
 * still has a time base. The embedded player itself may ignore the commands.
 */
export function createLimitedEmbedAdapter(
  provider: "vk" | "rutube",
  externalId: string,
  mount: HTMLElement,
  parentHost: string,
): PlayerAdapter {
  const host = fillMount(mount);
  const frame = document.createElement("iframe");
  frame.src = embedSrc({ provider, externalId }, parentHost);
  frame.allow = "autoplay; fullscreen; encrypted-media";
  frame.allowFullscreen = true;
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.border = "0";
  host.appendChild(frame);
  const events = createObserver();
  let positionMs = 0;
  let playing = false;
  let lastTick = Date.now();
  let phase: PlayerObservation["phase"] = "loading";

  const snapshot = (): PlayerObservation => {
    if (playing) {
      positionMs += Date.now() - lastTick;
    }
    lastTick = Date.now();
    return { phase, positionMs, durationMs: null, bufferedMs: null, aspectRatio: null };
  };

  const post = (payload: Record<string, unknown>) => {
    frame.contentWindow?.postMessage(JSON.stringify(payload), "*");
  };

  frame.addEventListener("load", () => {
    phase = "ready";
    events.emit(snapshot());
  });

  const timer = window.setInterval(() => {
    if (playing) {
      events.emit(snapshot());
    }
  }, 500);

  return {
    provider: provider satisfies EmbedProvider,
    limited: true,
    async play() {
      snapshot();
      playing = true;
      phase = "playing";
      post({ type: "player:play", method: "play" });
      events.emit(snapshot());
    },
    async pause() {
      snapshot();
      playing = false;
      phase = "paused";
      post({ type: "player:pause", method: "pause" });
      events.emit(snapshot());
    },
    async seek(nextMs: number) {
      positionMs = nextMs;
      lastTick = Date.now();
      post({ type: "player:seek", method: "seek", time: nextMs / 1000 });
      events.emit(snapshot());
    },
    getCurrentTime() {
      return snapshot().positionMs;
    },
    getDuration() {
      return null;
    },
    getBuffered() {
      return null;
    },
    onState: events.onState,
    destroy() {
      window.clearInterval(timer);
      mount.replaceChildren();
    },
  };
}
