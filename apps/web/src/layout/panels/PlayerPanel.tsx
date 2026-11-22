import { positionAt, shouldCorrectDrift, type AdapterPhase, type PlayerAdapter } from "@lume/contracts";
import { Maximize, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";
import { Button, Icon, IconButton } from "../../ds/index.js";
import { cx } from "../../ds/cx.js";
import { useI18n } from "../../i18n/context.js";
import styles from "./PlayerPanel.module.css";
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
  stage,
  overlay,
  controls,
  reload,
}: {
  aspect: number;
  onAspect: (aspect: number) => void;
  onError?: (url: string) => void;
  stage: Omit<ComponentPropsWithRef<"div">, "ref" | "children" | "className"> & Record<`data-${string}`, string>;
  overlay: ReactNode;
  controls: ReactNode;
  reload: number;
}) {
  const { t } = useI18n();
  const handed = useRef(false);
  const live = useRoomActions();
  const frameRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const phaseRef = useRef<AdapterPhase>("idle");
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [blocked, setBlocked] = useState(false);
  const [rate, setRate] = useState(1);
  const playback = live?.state.playback ?? null;
  const nowPlaying = live?.state.room.nowPlaying ?? null;
  const mediaId = nowPlaying?.id;
  const mediaUrl = nowPlaying?.url;
  const mediaProvider = nowPlaying?.provider;
  const mediaExternalId = nowPlaying?.externalId;
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
    if (!mount) return;
    mount.style.width = `${box.width}px`;
    mount.style.height = `${box.height}px`;
  }, [box, mediaId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !mediaId || !mediaUrl || mediaProvider === undefined || mediaExternalId === undefined) {
      adapterRef.current?.destroy();
      adapterRef.current = null;
      return;
    }
    let cancelled = false;
    setBlocked(false);
    setRate(1);
    void createPlayerAdapter({ provider: mediaProvider, url: mediaUrl, externalId: mediaExternalId }, mount, window.location.hostname)
      .then((adapter) => {
        if (cancelled) {
          adapter.destroy();
          return;
        }
        adapterRef.current = adapter;
        if (canControlRef.current) applyHostPlayback(adapter);
        adapter.onState((state) => {
          if (cancelled) return;
          phaseRef.current = state.phase;
          if (state.phase === "error") onErrorRef.current?.(mediaUrl);
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
      .catch(() => { if (!cancelled) onErrorRef.current?.(mediaUrl); });
    return () => {
      cancelled = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, [applyHostPlayback, mediaId, mediaUrl, mediaProvider, mediaExternalId, reload]);

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
    <>
      <div {...stage} className={styles.stage} ref={frameRef}>
        {nowPlaying ? (
          <div ref={mountRef} className={styles.embed} data-testid="player-mount" />
        ) : (
          <div className={styles.empty} data-testid="player-empty">
            <span className={styles.emptyIcon}><Icon icon={Play} size="lg" /></span>
            <h2 className={styles.emptyTitle}>{t("player.emptyTitle")}</h2>
            <p className={styles.emptyBody}>{t("player.emptyBody")}</p>
          </div>
        )}
        {nowPlaying && blocked ? (
          <button type="button" className={styles.unblock} onClick={() => void adapterRef.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true))}>
            {t("player.unblock")}
          </button>
        ) : null}
        {overlay}
      </div>
      <div className={cx(styles.playbar)} data-testid="room-playbar">
        {controls}
        {nowPlaying ? (
          <div className={styles.tools}>
            <Button
              size="sm"
              variant="ghost"
              title={t("player.speed")}
              aria-label={t("player.speed")}
              onClick={() => {
                const rates = [1, 1.25, 1.5, 2] as const;
                const next = rates[(rates.indexOf(rate as 1 | 1.25 | 1.5 | 2) + 1) % rates.length] ?? 1;
                setRate(next);
                adapterRef.current?.setPlaybackRate?.(next);
              }}
            >
              {rate}×
            </Button>
            <IconButton
              icon={Maximize}
              size="sm"
              variant="ghost"
              label={t("player.fullscreen")}
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
                else void frameRef.current?.requestFullscreen?.().catch(() => undefined);
              }}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
