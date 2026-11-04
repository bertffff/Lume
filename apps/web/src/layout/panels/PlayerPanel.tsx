import { embedSrc, type PlaybackSnapshot } from "@lume/contracts";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/context.js";
import { containSize } from "../contain.js";
import { commandEmbed } from "../../player/command.js";
import { useRoomActions } from "../../room/live.js";

const aspects = [
  { id: "16:9", value: 16 / 9 },
  { id: "4:3", value: 4 / 3 },
  { id: "1:1", value: 1 },
  { id: "9:16", value: 9 / 16 },
] as const;

function nearestAspect(aspect: number) {
  return aspects.reduce((best, item) =>
    Math.abs(item.value - aspect) < Math.abs(best.value - aspect) ? item : best,
  );
}

function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PlayerPanel({
  aspect,
  onAspect,
}: {
  aspect: number;
  synced: boolean;
  onAspect: (aspect: number) => void;
}) {
  const { t } = useI18n();
  const live = useRoomActions();
  const frameRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const current = nearestAspect(aspect);
  const playback: PlaybackSnapshot | null = live?.state.playback ?? null;
  const nowPlaying = live?.state.room.nowPlaying ?? null;

  useEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBox(containSize(rect.width, rect.height, aspect));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);

  useEffect(() => {
    if (!nowPlaying || !playback) {
      return;
    }
    commandEmbed(
      embedRef.current,
      nowPlaying.provider,
      playback.status === "playing" ? "play" : "pause",
      playback.positionMs,
    );
  }, [nowPlaying?.id, nowPlaying?.provider, playback?.version, playback?.status, playback?.positionMs]);

  function cycleAspect() {
    const index = aspects.findIndex((item) => item.id === current.id);
    const next = aspects[(index + 1) % aspects.length];
    if (next) {
      onAspect(next.value);
    }
  }

  const playing = playback?.status === "playing";
  const label = `${playing ? t("room.syncPlay") : t("room.syncPause")} ${clock((live?.positionMs ?? 0) / 1000)}`;

  return (
    <section className="tr-panel tr-player" aria-label={t("player.stage")}>
      <header className="tr-panel-bar">
        <span>{t("player.stage")}</span>
        <span className="tr-chip" data-testid="playback-status">
          {label}
        </span>
      </header>
      <div className="tr-frame" ref={frameRef}>
        <div className="tr-stage" style={{ width: box.width, height: box.height }}>
          {nowPlaying ? (
            <iframe
              ref={embedRef}
              className="tr-embed"
              src={embedSrc(nowPlaying, window.location.hostname)}
              title={nowPlaying.title}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
            />
          ) : (
            <p className="tr-empty">{t("player.empty")}</p>
          )}
          {live?.canControl ? (
            <button
              type="button"
              className="tr-play"
              data-testid="playback-play"
              onClick={live.togglePlayback}
              aria-label={playing ? t("player.pause") : t("player.play")}
            >
              {playing ? "II" : "▶"}
            </button>
          ) : null}
        </div>
      </div>
      <footer className="tr-panel-bar">
        <button type="button" className="tr-text-button" onClick={cycleAspect}>
          {t("player.aspect")} {current.id}
        </button>
        {live?.canControl ? (
          <button type="button" className="tr-text-button" onClick={live.seekForward}>
            {t("player.seek")}
          </button>
        ) : null}
        {nowPlaying ? <span>{nowPlaying.title}</span> : null}
      </footer>
    </section>
  );
}
