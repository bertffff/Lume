import {
  embedCommand,
  embedSrc,
  parseEmbedEvent,
  type AdapterPhase,
  type EmbedProvider,
  type PlayerAdapter,
  type PlayerObservation,
} from "@lume/contracts";
import { createObserver, fillMount } from "./events.js";

/**
 * VK video_ext and Rutube play/embed both expose a postMessage bridge. This
 * adapter keeps a local clock as a fallback and replaces it whenever the
 * embed reports a real position.
 */
export function createEmbedBridgeAdapter(
  provider: Extract<EmbedProvider, "vk" | "rutube">,
  externalId: string,
  mount: HTMLElement,
  parentHost: string,
): PlayerAdapter {
  const host = fillMount(mount);
  const frame = document.createElement("iframe");
  frame.src = embedSrc({ provider, externalId }, parentHost);
  frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "origin";
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.border = "0";
  host.appendChild(frame);

  const events = createObserver();
  let positionMs = 0;
  let durationMs: number | null = null;
  let playing = false;
  let lastTick = Date.now();
  let phase: AdapterPhase = "loading";

  const snapshot = (): PlayerObservation => {
    const now = Date.now();
    if (playing) {
      positionMs += now - lastTick;
    }
    lastTick = now;
    return { phase, positionMs, durationMs, bufferedMs: null, aspectRatio: null };
  };

  const post = (command: Parameters<typeof embedCommand>[1]) => {
    frame.contentWindow?.postMessage(embedCommand(provider, command), "*");
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) {
      return;
    }
    const parsed = parseEmbedEvent(provider, event.data);
    if (!parsed) {
      return;
    }
    if (parsed.kind === "time") {
      positionMs = parsed.positionMs;
      lastTick = Date.now();
      events.emit(snapshot());
      return;
    }
    if (parsed.kind === "duration") {
      durationMs = parsed.durationMs;
      events.emit(snapshot());
      return;
    }
    if (parsed.kind === "ready") {
      phase = "ready";
    } else if (parsed.kind === "playing") {
      phase = "playing";
      playing = true;
    } else if (parsed.kind === "buffering") {
      phase = "buffering";
    } else if (parsed.kind === "ended") {
      phase = "ended";
      playing = false;
    } else {
      phase = "error";
      playing = false;
    }
    events.emit(snapshot());
  };

  window.addEventListener("message", onMessage);
  frame.addEventListener("load", () => {
    if (phase === "loading") {
      phase = "ready";
      events.emit(snapshot());
    }
  });

  const timer = window.setInterval(() => {
    if (playing) {
      events.emit(snapshot());
    }
  }, 500);

  return {
    provider,
    limited: false,
    async play() {
      playing = true;
      phase = "playing";
      lastTick = Date.now();
      post({ type: "play" });
      events.emit(snapshot());
    },
    async pause() {
      snapshot();
      playing = false;
      phase = "paused";
      post({ type: "pause" });
      events.emit(snapshot());
    },
    async seek(nextMs: number) {
      positionMs = Math.max(0, nextMs);
      lastTick = Date.now();
      post({ type: "seek", positionMs });
      events.emit(snapshot());
    },
    getCurrentTime() {
      return snapshot().positionMs;
    },
    getDuration() {
      return durationMs;
    },
    getBuffered() {
      return null;
    },
    onState: events.onState,
    destroy() {
      window.clearInterval(timer);
      window.removeEventListener("message", onMessage);
      mount.replaceChildren();
    },
  };
}
