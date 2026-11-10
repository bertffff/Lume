import {
  planDrift,
  planFollowerSync,
  positionAt,
  type AdapterPhase,
  type DriftSeek,
  type PlaybackSnapshot,
  type PlayerAdapter,
} from "@lume/contracts";
import { useEffect, useRef, type RefObject } from "react";

export function useFollowSync(input: {
  enabled: boolean;
  playback: PlaybackSnapshot | null;
  offsetMs: number;
  adapterRef: RefObject<PlayerAdapter | null>;
  phaseRef: RefObject<AdapterPhase>;
  onBlocked: () => void;
}) {
  const { enabled, playback, offsetMs, adapterRef, phaseRef, onBlocked } = input;
  const seeks = useRef<DriftSeek[]>([]);
  const loadedAt = useRef(Date.now());
  useEffect(() => {
    loadedAt.current = Date.now();
    seeks.current = [];
  }, [playback?.version]);
  useEffect(() => {
    if (!enabled || !playback) {
      return;
    }
    let stopped = false;
    const apply = async () => {
      const adapter = adapterRef.current;
      if (!adapter || stopped) {
        return;
      }
      const authority =
        playback.status === "paused"
          ? playback.anchorPositionMs
          : positionAt(
              {
                status: playback.status,
                anchorPositionMs: playback.anchorPositionMs,
                anchorServerTimeMs: playback.anchorServerTimeMs,
                version: playback.version,
                updatedBy: playback.updatedBy,
              },
              Date.now() + offsetMs,
            );
      const phase = phaseRef.current ?? "loading";
      const drift = planDrift({
        localMs: adapter.getCurrentTime(),
        expectedMs: authority,
        embed: adapter.limited,
        loadedAgoMs: Date.now() - loadedAt.current,
        bufferedToMs: adapter.getBuffered(),
        recentSeeks: seeks.current,
        nowMs: Date.now(),
        buffering: phase === "buffering",
        bufferEndedAtMs: null,
      });
      const plan = planFollowerSync({
        playback: playback.status,
        adapterPhase: phase,
        localMs: adapter.getCurrentTime(),
        authorityMs: authority,
        thresholdMs: drift.status === "hard-seeking" ? 0 : 1_000_000,
      });
      if (drift.seekToMs !== null) {
        seeks.current = [...seeks.current, { atMs: Date.now(), targetMs: drift.seekToMs }].slice(-6);
        await adapter.seek(Math.max(0, Math.round(drift.seekToMs)));
      } else {
        adapter.setPlaybackRate?.(drift.playbackRate ?? 1);
      }
      if (plan.pause) {
        await adapter.pause();
      }
      if (plan.play) {
        try {
          await adapter.play();
        } catch {
          onBlocked();
        }
      }
    };
    void apply();
    const timer = window.setInterval(() => void apply(), 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [adapterRef, enabled, offsetMs, onBlocked, phaseRef, playback]);
}
