import type { EmbedProvider, PlayerAdapter, PlayerObservation } from "@lume/contracts";
import Hls from "hls.js";
import { createObserver, fillMount } from "./events.js";

function bufferedEnd(video: HTMLVideoElement): number | null {
  if (video.buffered.length === 0) {
    return null;
  }
  return Math.round(video.buffered.end(video.buffered.length - 1) * 1000);
}

export function createHtml5Adapter(url: string, mount: HTMLElement, hls: boolean): PlayerAdapter {
  const host = fillMount(mount);
  const video = document.createElement("video");
  video.controls = false;
  video.playsInline = true;
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.background = "black";
  host.appendChild(video);
  const events = createObserver();
  let phase: PlayerObservation["phase"] = "loading";
  let hlsPlayer: Hls | null = null;

  const emit = (next: PlayerObservation["phase"]) => {
    phase = next;
    const width = video.videoWidth;
    const height = video.videoHeight;
    events.emit({
      phase,
      positionMs: Math.round(video.currentTime * 1000),
      durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null,
      bufferedMs: bufferedEnd(video),
      aspectRatio: width > 0 && height > 0 ? width / height : null,
    });
  };

  video.addEventListener("loadedmetadata", () => emit("ready"));
  video.addEventListener("canplay", () => emit(video.paused ? "ready" : "playing"));
  video.addEventListener("playing", () => emit("playing"));
  video.addEventListener("pause", () => emit("paused"));
  video.addEventListener("waiting", () => emit("buffering"));
  video.addEventListener("ended", () => emit("ended"));
  video.addEventListener("error", () => emit("error"));

  if (hls && Hls.isSupported()) {
    hlsPlayer = new Hls();
    hlsPlayer.loadSource(url);
    hlsPlayer.attachMedia(video);
  } else {
    video.src = url;
  }

  return {
    provider: "direct" satisfies EmbedProvider,
    limited: false,
    async play() {
      await video.play();
    },
    async pause() {
      video.pause();
    },
    async seek(positionMs: number) {
      video.currentTime = positionMs / 1000;
    },
    getCurrentTime() {
      return Math.round(video.currentTime * 1000);
    },
    getDuration() {
      return Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null;
    },
    getBuffered() {
      return bufferedEnd(video);
    },
    onState: events.onState,
    destroy() {
      hlsPlayer?.destroy();
      video.removeAttribute("src");
      video.load();
      mount.replaceChildren();
    },
  };
}
