import type { EmbedProvider, PlayerAdapter } from "@lume/contracts";
import { createObserver, fillMount } from "./events.js";

/** DASH mount. The video element loads the manifest; browsers with DASH support play it. */
export function createDashAdapter(url: string, mount: HTMLElement): PlayerAdapter {
  const host = fillMount(mount);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.dataset.kind = "dash";
  video.style.width = "100%";
  video.style.height = "100%";
  host.appendChild(video);
  const events = createObserver();
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
    setPlaybackRate(rate: number) {
      video.playbackRate = rate;
    },
    getCurrentTime() {
      return Math.round(video.currentTime * 1000);
    },
    getDuration() {
      return Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null;
    },
    getBuffered() {
      return video.buffered.length === 0 ? null : Math.round(video.buffered.end(video.buffered.length - 1) * 1000);
    },
    onState: events.onState,
    destroy() {
      video.removeAttribute("src");
      video.load();
      mount.replaceChildren();
    },
  };
}
