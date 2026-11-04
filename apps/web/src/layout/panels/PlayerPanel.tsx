import {
  shouldCorrectDrift,
  positionAt,
  type AdapterPhase,
  type PlaybackSnapshot,
  type PlayerAdapter,
} from "@lume/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/context.js";
import { containSize } from "../contain.js";
import { createPlayerAdapter } from "../../player/create.js";
import { useFollowSync } from "../../player/useFollowSync.js";
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
  synced?: boolean;
  onAspect: (aspect: number) => void;
}) {
  const { t } = useI18n();
  const live = useRoomActions();
  const frameRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const phaseRef = useRef<AdapterPhase>("idle");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [limited, setLimited] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const current = nearestAspect(aspect);
  const playback: PlaybackSnapshot | null = live?.state.playback ?? null;
  const nowPlaying = live?.state.room.nowPlaying ?? null;
  const reportedAspect = useRef(aspect);
  const reportViewerRef = useRef(live?.reportViewer);
  const canControlRef = useRef(live?.canControl);
  const setPlaybackRef = useRef(live?.setPlayback);
  reportViewerRef.current = live?.reportViewer;
  canControlRef.current = live?.canControl;
  setPlaybackRef.current = live?.setPlayback;
  const onBlocked = useCallback(() => setBlocked(true), []);
  const playbackStatusRef = useRef(playback?.status);
  playbackStatusRef.current = playback?.status;
  const onAspectRef = useRef(onAspect);
  onAspectRef.current = onAspect;

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
    const mount = mountRef.current;
    if (!mount || !nowPlaying) {
      adapterRef.current?.destroy();
      adapterRef.current = null;
      return;
    }
    let cancelled = false;
    setLimited(false);
    setBlocked(false);
    void createPlayerAdapter(nowPlaying, mount, window.location.hostname)
      .then((adapter) => {
        if (cancelled) {
          adapter.destroy();
          return;
        }
        adapterRef.current = adapter;
        setLimited(adapter.limited);
        adapter.onState((state) => {
          phaseRef.current = state.phase;
          if (canControlRef.current && playbackStatusRef.current === "playing" && state.phase === "ready") {
            void adapter.play();
          }
          if (
            state.aspectRatio &&
            state.aspectRatio > 0 &&
            Math.abs(state.aspectRatio - reportedAspect.current) > 0.04
          ) {
            reportedAspect.current = state.aspectRatio;
            onAspectRef.current(state.aspectRatio);
          }
          if (
            !canControlRef.current &&
            (state.phase === "buffering" || state.phase === "ready" || state.phase === "playing")
          ) {
            reportViewerRef.current?.(state.phase === "buffering" ? "buffering" : "ready");
          }
        });
      })
      .catch(() => {
        phaseRef.current = "error";
      });
    return () => {
      cancelled = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, [nowPlaying]);

  useFollowSync({
    enabled: Boolean(live && !live.canControl && playback),
    playback,
    offsetMs: live?.offsetMs ?? 0,
    adapterRef,
    phaseRef,
    onBlocked,
  });

  useEffect(() => {
    if (!live?.canControl || !playback || playback.status !== "playing") {
      return;
    }
    const timer = window.setInterval(() => {
      const adapter = adapterRef.current;
      if (!adapter) {
        return;
      }
      const predicted = positionAt(
        {
          status: playback.status,
          anchorPositionMs: playback.anchorPositionMs,
          anchorServerTimeMs: playback.anchorServerTimeMs,
          version: playback.version,
          updatedBy: playback.updatedBy,
        },
        Date.now() + (live.offsetMs ?? 0),
      );
      const actual = adapter.getCurrentTime();
      if (shouldCorrectDrift(actual, predicted)) {
        setPlaybackRef.current?.("seek", Math.max(0, Math.round(actual)));
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [live?.canControl, live?.offsetMs, playback]);

  function cycleAspect() {
    const index = aspects.findIndex((item) => item.id === current.id);
    const next = aspects[(index + 1) % aspects.length];
    if (next) {
      onAspect(next.value);
    }
  }

  async function toggle() {
    const adapter = adapterRef.current;
    if (!live) {
      return;
    }
    if (playback?.status === "playing") {
      const position = Math.round(adapter?.getCurrentTime() ?? live.positionMs);
      live.setPlayback("pause", position);
      await adapter?.pause();
      return;
    }
    const position = Math.round(adapter?.getCurrentTime() ?? 0);
    live.setPlayback("play", position);
    if (!adapter) {
      return;
    }
    try {
      await adapter.play();
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  }

  async function seekForward() {
    const adapter = adapterRef.current;
    const base = adapter?.getCurrentTime() ?? live?.positionMs ?? 0;
    const next = Math.round(base + 15_000);
    await adapter?.seek(next);
    live?.setPlayback("seek", next);
  }

  async function unblock() {
    try {
      await adapterRef.current?.play();
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  }

  const playing = playback?.status === "playing";
  const label = `${playing ? t("room.syncPlay") : t("room.syncPause")} ${clock((live?.positionMs ?? 0) / 1000)}`;
  const bufferingNames =
    live?.state.viewers
      .filter((viewer) => viewer.phase === "buffering")
      .map((viewer) => live.state.members.find((member) => member.userId === viewer.userId)?.displayName ?? viewer.userId) ??
    [];

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
            <div ref={mountRef} className="tr-embed" data-testid="player-mount" />
          ) : (
            <p className="tr-empty">{t("player.empty")}</p>
          )}
          {live?.canControl ? (
            <button
              type="button"
              className="tr-play"
              data-testid="playback-play"
              onClick={() => void toggle()}
              aria-label={playing ? t("player.pause") : t("player.play")}
            >
              {playing ? "II" : "▶"}
            </button>
          ) : null}
          {blocked ? (
            <button type="button" className="tr-play" onClick={() => void unblock()}>
              {t("player.unblock")}
            </button>
          ) : null}
        </div>
      </div>
      <footer className="tr-panel-bar">
        <button type="button" className="tr-text-button" onClick={cycleAspect}>
          {t("player.aspect")} {current.id}
        </button>
        {live?.canControl ? (
          <button type="button" className="tr-text-button" onClick={() => void seekForward()}>
            {t("player.seek")}
          </button>
        ) : null}
        {nowPlaying ? <span>{nowPlaying.title}</span> : null}
        {limited ? <span className="tr-chip">{t("player.limited")}</span> : null}
        {bufferingNames.length > 0 ? (
          <span className="tr-chip" data-testid="buffering-list">
            {t("player.buffering")}: {bufferingNames.join(", ")}
          </span>
        ) : null}
      </footer>
    </section>
  );
}
