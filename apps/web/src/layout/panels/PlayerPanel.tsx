import { positionAt, shouldCorrectDrift, type AdapterPhase, type PlayerAdapter } from "@lume/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/context.js";
import { containSize } from "../contain.js";
import { createPlayerAdapter } from "../../player/create.js";
import { useFollowSync } from "../../player/useFollowSync.js";
import { useRoomActions } from "../../room/live.js";

/**
 * The live room renders the player inside its own stage card. The former
 * standalone panel chrome is gone with the unused RoomLayoutView.
 */
export function PlayerPanel({
  aspect,
  onAspect,
  onError,
}: {
  aspect: number;
  synced?: boolean;
  onAspect: (aspect: number) => void;
  bare?: boolean;
  onError?: (url: string) => void;
}) {
  const { t } = useI18n();
  const handed = useRef(false);
  const [emptyUrl, setEmptyUrl] = useState("");
  const live = useRoomActions();
  const frameRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const phaseRef = useRef<AdapterPhase>("idle");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [blocked, setBlocked] = useState(false);
  const playback = live?.state.playback ?? null;
  const nowPlaying = live?.state.room.nowPlaying ?? null;
  const reportedAspect = useRef(aspect);
  const reportViewerRef = useRef(live?.reportViewer);
  const canControlRef = useRef(live?.canControl);
  const playNextRef = useRef(live?.playNext);
  const setPlaybackRef = useRef(live?.setPlayback);
  const onAspectRef = useRef(onAspect);
  const onErrorRef = useRef(onError);
  const playbackRef = useRef(playback);
  const offsetRef = useRef(live?.offsetMs ?? 0);
  const lastHostCommand = useRef("");
  reportViewerRef.current = live?.reportViewer;
  canControlRef.current = live?.canControl;
  playNextRef.current = live?.playNext;
  setPlaybackRef.current = live?.setPlayback;
  onAspectRef.current = onAspect;
  onErrorRef.current = onError;
  playbackRef.current = playback;
  offsetRef.current = live?.offsetMs ?? 0;

  useEffect(() => {
    if (handed.current || !live) return;
    const params = new URLSearchParams(window.location.search);
    const video = params.get("v");
    const at = params.get("t");
    if (!video && !at) return;
    handed.current = true;
    if (video) live.addQueue(video);
    if (at && Number.isFinite(Number(at))) live.setPlayback("seek", Number(at) * 1000);
  }, [live]);

  const onBlocked = useCallback(() => setBlocked(true), []);
  const applyHostPlayback = useCallback((adapter: PlayerAdapter) => {
    const snapshot = playbackRef.current;
    if (!snapshot) return;
    const target = Math.max(
      0,
      Math.round(
        positionAt(
          {
            status: snapshot.status,
            anchorPositionMs: snapshot.anchorPositionMs,
            anchorServerTimeMs: snapshot.anchorServerTimeMs,
            version: snapshot.version,
            updatedBy: snapshot.updatedBy,
          },
          Date.now() + offsetRef.current,
        ),
      ),
    );
    if (snapshot.status === "playing") {
      void adapter.seek(target).then(() => adapter.play()).catch(() => undefined);
    } else {
      void adapter.pause().then(() => adapter.seek(target)).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
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
    setBlocked(false);
    void createPlayerAdapter(nowPlaying, mount, window.location.hostname)
      .then((adapter) => {
        if (cancelled) {
          adapter.destroy();
          return;
        }
        adapterRef.current = adapter;
        if (canControlRef.current) applyHostPlayback(adapter);
        adapter.onState((state) => {
          if (state.phase === "error") onErrorRef.current?.(nowPlaying?.url ?? "");
          if (canControlRef.current && playbackRef.current?.status === "playing" && state.phase === "ready") {
            void adapter.play();
          }
          if (canControlRef.current && state.phase === "ended") playNextRef.current?.();
          if (state.aspectRatio && state.aspectRatio > 0 && Math.abs(state.aspectRatio - reportedAspect.current) > 0.04) {
            reportedAspect.current = state.aspectRatio;
            onAspectRef.current(state.aspectRatio);
          }
          if (!canControlRef.current && (state.phase === "buffering" || state.phase === "ready" || state.phase === "playing")) {
            reportViewerRef.current?.(state.phase === "buffering" ? "buffering" : "ready");
          }
        });
      })
      .catch(() => onErrorRef.current?.(nowPlaying?.url ?? ""));
    return () => {
      cancelled = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, [applyHostPlayback, nowPlaying]);

  useEffect(() => {
    if (!live?.canControl || !playback || !nowPlaying) return;
    const key = `${nowPlaying.id}:${playback.version}:${playback.status}`;
    if (lastHostCommand.current === key) return;
    lastHostCommand.current = key;
    if (adapterRef.current) applyHostPlayback(adapterRef.current);
  }, [applyHostPlayback, live?.canControl, nowPlaying, playback]);

  useFollowSync({
    enabled: Boolean(live && !live.canControl && playback),
    playback,
    offsetMs: live?.offsetMs ?? 0,
    adapterRef,
    phaseRef,
    onBlocked,
  });

  useEffect(() => {
    if (!live?.canControl || !playback || playback.status !== "playing") return;
    const timer = window.setInterval(() => {
      const adapter = adapterRef.current;
      if (!adapter) return;
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

  return (
    <div className="player-frame bare-stage" ref={frameRef}>
      {nowPlaying ? (
        <div ref={mountRef} className="player-embed" data-testid="player-mount" style={{ width: box.width, height: box.height }} />
      ) : (
        <div className="player-empty" data-testid="player-empty">
          <span className="pe-ic" aria-hidden="true">▶</span>
          <h2>{t("player.emptyTitle")}</h2>
          <p>{t("player.emptyBody")}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = emptyUrl.trim();
              if (!next) return;
              live?.addQueue(next);
              setEmptyUrl("");
            }}
          >
            <input
              value={emptyUrl}
              onChange={(event) => setEmptyUrl(event.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              aria-label={t("queue.url")}
              data-testid="player-empty-url"
            />
            <button type="submit" className="btn btn-primary" data-testid="player-empty-add">
              {t("queue.add")}
            </button>
          </form>
          <span className="pe-hint">{t("player.emptyHint")}</span>
        </div>
      )}
      {nowPlaying && blocked ? (
        <button type="button" className="player-unblock" onClick={() => void adapterRef.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true))}>
          {t("player.unblock")}
        </button>
      ) : null}
    </div>
  );
}
