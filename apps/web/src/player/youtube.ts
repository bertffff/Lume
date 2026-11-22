import type { PlayerAdapter, PlayerObservation } from "@lume/contracts";
import { createObserver, fillMount } from "./events.js";

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoLoadedFraction: () => number;
  destroy: () => void;
}

interface YouTubeStateEvent {
  data: number;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          width?: string;
          height?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: YouTubeStateEvent) => void;
            onError?: () => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState: { PLAYING: number; PAUSED: number; BUFFERING: number; ENDED: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApi: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  youtubeApi ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return youtubeApi;
}

function phaseFromYouTube(code: number): PlayerObservation["phase"] {
  const states = window.YT?.PlayerState;
  if (!states) {
    return "loading";
  }
  if (code === states.PLAYING) {
    return "playing";
  }
  if (code === states.PAUSED) {
    return "paused";
  }
  if (code === states.BUFFERING) {
    return "buffering";
  }
  if (code === states.ENDED) {
    return "ended";
  }
  if (code === states.CUED) {
    return "ready";
  }
  return "loading";
}

export async function createYouTubeAdapter(videoId: string, mount: HTMLElement): Promise<PlayerAdapter> {
  await loadYouTubeApi();
  const host = fillMount(mount);
  const events = createObserver();
  const Player = window.YT?.Player;
  if (!Player) {
    throw new Error("youtube_unavailable");
  }
  let player: YouTubePlayer | null = null;
  let phase: PlayerObservation["phase"] = "loading";

  const read = (readValue: () => number) => {
    try {
      const value = readValue();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  };
  const snapshot = (): PlayerObservation => {
    const duration = player ? Math.round(read(() => player!.getDuration()) * 1000) : 0;
    const fraction = player ? read(() => player!.getVideoLoadedFraction()) : 0;
    return {
      phase,
      positionMs: player ? Math.round(read(() => player!.getCurrentTime()) * 1000) : 0,
      durationMs: duration > 0 ? duration : null,
      bufferedMs: duration > 0 ? Math.round(fraction * duration) : null,
      aspectRatio: null,
    };
  };

  player = new Player(host, {
    videoId,
    width: "100%",
    height: "100%",
    playerVars: { enablejsapi: 1, origin: window.location.origin, rel: 0 },
    events: {
      onReady: () => {
        phase = "ready";
        events.emit(snapshot());
      },
      onStateChange: (event) => {
        phase = phaseFromYouTube(event.data);
        events.emit(snapshot());
      },
      onError: () => {
        phase = "error";
        events.emit(snapshot());
      },
    },
  });

  return {
    provider: "youtube",
    limited: false,
    async play() {
      player?.playVideo();
    },
    async pause() {
      player?.pauseVideo();
    },
    async seek(positionMs: number) {
      player?.seekTo(positionMs / 1000, true);
    },
    getCurrentTime() {
      return snapshot().positionMs;
    },
    getDuration() {
      return snapshot().durationMs;
    },
    getBuffered() {
      return snapshot().bufferedMs;
    },
    onState: events.onState,
    destroy() {
      player?.destroy();
      player = null;
      mount.replaceChildren();
    },
  };
}
