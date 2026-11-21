import type { PlayerAdapter, PlayerObservation } from "@lume/contracts";
import { createObserver, fillMount } from "./events.js";

interface TwitchPlayer {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  addEventListener: (event: string, listener: () => void) => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    Twitch?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          width: string;
          height: string;
          video?: string;
          channel?: string;
          parent: string[];
          autoplay: boolean;
        },
      ) => TwitchPlayer;
    };
  }
}

let twitchApi: Promise<void> | null = null;

function loadTwitchApi(): Promise<void> {
  if (window.Twitch?.Player) {
    return Promise.resolve();
  }
  twitchApi ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("twitch_unavailable"));
    document.head.appendChild(script);
  });
  return twitchApi;
}

export async function createTwitchAdapter(
  externalId: string,
  mount: HTMLElement,
  parentHost: string,
): Promise<PlayerAdapter> {
  await loadTwitchApi();
  const host = fillMount(mount);
  const events = createObserver();
  const Player = window.Twitch?.Player;
  if (!Player) {
    throw new Error("twitch_unavailable");
  }
  const video = externalId.startsWith("video:") ? externalId.slice("video:".length) : undefined;
  const channel = externalId.startsWith("channel:") ? externalId.slice("channel:".length) : undefined;
  const player = new Player(host, {
    width: "100%",
    height: "100%",
    autoplay: false,
    parent: [parentHost],
    ...(video ? { video } : {}),
    ...(channel ? { channel } : {}),
  });
  let phase: PlayerObservation["phase"] = "loading";
  const emit = (next: PlayerObservation["phase"]) => {
    phase = next;
    events.emit({
      phase,
      positionMs: Math.round((player.getCurrentTime() || 0) * 1000),
      durationMs: player.getDuration() > 0 ? Math.round(player.getDuration() * 1000) : null,
      bufferedMs: null,
      aspectRatio: null,
    });
  };
  player.addEventListener("ready", () => emit("ready"));
  player.addEventListener("play", () => emit("playing"));
  player.addEventListener("pause", () => emit("paused"));
  player.addEventListener("ended", () => emit("ended"));

  return {
    provider: "twitch",
    limited: false,
    async play() {
      player.play();
    },
    async pause() {
      player.pause();
    },
    async seek(positionMs: number) {
      player.seek(positionMs / 1000);
    },
    getCurrentTime() {
      return Math.round((player.getCurrentTime() || 0) * 1000);
    },
    getDuration() {
      return player.getDuration() > 0 ? Math.round(player.getDuration() * 1000) : null;
    },
    getBuffered() {
      return null;
    },
    onState: events.onState,
    destroy() {
      player.destroy?.();
      mount.replaceChildren();
    },
  };
}
