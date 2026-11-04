import {
  planFollowerSync,
  positionAt,
  type AdapterPhase,
  type PlaybackSnapshot,
  type PlayerAdapter,
} from "@lume/contracts";
import { useEffect, type RefObject } from "react";

export function useFollowSync(input: {
  enabled: boolean;
  playback: PlaybackSnapshot | null;
  offsetMs: number;
  adapterRef: RefObject<PlayerAdapter | null>;
  phaseRef: RefObject<AdapterPhase>;
  onBlocked: () => void;
}) {
  const { enabled, playback, offsetMs, adapterRef, phaseRef, onBlocked } = input;
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
      const plan = planFollowerSync({
        playback: playback.status,
        adapterPhase: phaseRef.current ?? "loading",
        localMs: adapter.getCurrentTime(),
        authorityMs: authority,
      });
      if (plan.seekToMs !== null) {
        await adapter.seek(Math.max(0, Math.round(plan.seekToMs)));
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
