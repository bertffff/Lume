import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";

export interface GlobalStats {
  usersOnline: number;
  activeRooms: number;
  totalVideos: number;
  totalWatchHours: number;
}

const shotStats: GlobalStats = { usersOnline: 12, activeRooms: 3, totalVideos: 148, totalWatchHours: 42.5 };

/** Global counters poll every 30s; the design-preview shot uses fixed numbers. */
export function useGlobalStats(shot: string | null, path: string, roomId: string | null) {
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    usersOnline: 0,
    activeRooms: 0,
    totalVideos: 0,
    totalWatchHours: 0,
  });
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    if (shot) {
      setGlobalStats(shotStats);
      setStatsReady(true);
      return;
    }
    let stopped = false;
    const load = () => {
      void fetch(`${apiUrl}/stats/global`)
        .then((response) => response.json())
        .then((payload: Partial<GlobalStats>) => {
          if (!stopped) {
            setGlobalStats({
              usersOnline: Number(payload.usersOnline ?? 0),
              activeRooms: Number(payload.activeRooms ?? 0),
              totalVideos: Number(payload.totalVideos ?? 0),
              totalWatchHours: Number(payload.totalWatchHours ?? 0),
            });
            setStatsReady(true);
          }
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [path, roomId, shot]);

  return { globalStats, statsReady };
}
