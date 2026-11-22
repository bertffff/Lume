import type { PlayerAdapter, PlayerObservation } from "@lume/contracts";
import Player from "@vimeo/player";
import { createObserver, fillMount } from "./events.js";

export async function createVimeoAdapter(pageUrl: string, mount: HTMLElement): Promise<PlayerAdapter> {
  const host = fillMount(mount);
  const events = createObserver();
  const player = new Player(host, { url: pageUrl, responsive: true } as ConstructorParameters<typeof Player>[1]);
  let phase: PlayerObservation["phase"] = "loading";
  let durationMs: number | null = null;
  let positionMs = 0;
  const bufferedMs: number | null = null;

  const emit = () => {
    events.emit({ phase, positionMs, durationMs, bufferedMs, aspectRatio: null });
  };

  player.on("loaded", () => {
    phase = "ready";
    emit();
  });
  player.on("play", () => {
    phase = "playing";
    emit();
  });
  player.on("pause", () => {
    phase = "paused";
    emit();
  });
  player.on("bufferstart", () => {
    phase = "buffering";
    emit();
  });
  player.on("bufferend", () => {
    phase = "playing";
    emit();
  });
  player.on("ended", () => {
    phase = "ended";
    emit();
  });
  player.on("timeupdate", (data: { seconds: number }) => {
    positionMs = Math.round(data.seconds * 1000);
  });
  void player.getDuration().then((seconds) => {
    durationMs = Math.round(seconds * 1000);
    emit();
  }).catch(() => undefined);

  return {
    provider: "vimeo",
    limited: false,
    async play() {
      await player.play();
    },
    async pause() {
      await player.pause();
    },
    async seek(nextMs: number) {
      await player.setCurrentTime(nextMs / 1000);
      positionMs = nextMs;
    },
    getCurrentTime() {
      return positionMs;
    },
    getDuration() {
      return durationMs;
    },
    getBuffered() {
      return bufferedMs;
    },
    onState: events.onState,
    destroy() {
      void player.destroy();
      mount.replaceChildren();
    },
  };
}
