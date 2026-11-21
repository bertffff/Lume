import { planPlayback, type QueueItem } from "@lume/contracts";
import { useState, type RefObject } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { useRoomMeta } from "../room/hooks/useRoomMeta.js";
import type { RoomActions } from "../room/live.js";
import { posterStyle } from "./posters.js";
import { roomClock } from "./RoomQueuePreview.js";

export function RoomQueue({ live, meta, queue, inputRef, refresh, refreshing }: {
  live: RoomActions;
  meta: ReturnType<typeof useRoomMeta>;
  queue: QueueItem[];
  inputRef: RefObject<HTMLInputElement>;
  refresh?: () => void;
  refreshing: "idle" | "busy" | "error";
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const plan = url.trim() ? planPlayback({ url: url.trim(), premium: meta.premium }) : null;
  const premiumGate = plan?.type === "error" && plan.code === "premium_required";
  const now = live.state.room.nowPlaying;
  const recommendations = meta.recommendations.filter((item) => item.url !== now?.url && !queue.some((queued) => queued.url === item.url)).slice(0, 4);

  async function detectSource(urlToDetect: string) {
    try {
      const response = await fetch(`${apiUrl}/video/detect`, {
        method: "POST",
        headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ url: urlToDetect }),
      });
      if (!response.ok) return;
      const { source } = (await response.json()) as { source?: string };
      const provider = source === "youtube" ? t("search.source.youtube") : source === "vk" ? t("search.source.vk")
        : source === "rutube" ? t("search.source.rutube") : source === "direct" ? t("search.source.direct")
        : source === "twitch" ? "Twitch" : source === "vimeo" ? "Vimeo" : null;
      setSourceLabel(provider);
    } catch {
      // Detection is supplemental; the server still owns queue acceptance.
    }
  }
  return (
    <div className="room-full-queue" data-testid="rail-queue">
      <section>
        <h3>{t("queue.now")}</h3>
        {now ? <div data-testid="queue-now" data-refresh-state={refreshing} className="room-queue-row">
          <span className="room-thumbnail" aria-hidden="true" style={posterStyle(now.id, now.thumbnailUrl)} /><b>{now.title}</b>
          {refresh && <button type="button" data-testid="queue-refresh" disabled={refreshing === "busy"} onClick={refresh}>{t(refreshing === "busy" ? "room.refreshing" : refreshing === "error" ? "room.refreshFailed" : "room.refreshLink")}</button>}
        </div> : <p className="room-empty">{t("room.nothingPlaying")}</p>}
      </section>
      <section>
        <h3>{t("room.upNext")} <small>{queue.length}</small></h3>
        {queue.length ? <ol>{queue.map((item) => (
          <li key={item.id} className="room-queue-row" data-testid="queue-item" data-url={item.url} data-provider={item.provider} data-title={item.title}>
            <span className="room-thumbnail" aria-hidden="true" style={posterStyle(item.id, item.thumbnailUrl)} /><b>{item.title}</b>
            {item.durationMs ? <small data-testid="queue-item-duration" data-duration-ms={item.durationMs}>{roomClock(item.durationMs)}</small> : null}
          </li>
        ))}</ol> : <p className="room-empty">{t("room.queueEmpty")}</p>}
        <form className="room-add" onSubmit={(event) => {
          event.preventDefault();
          const next = url.trim();
          if (!next) return;
          if (premiumGate) { setBlocked(true); return; }
          live.addQueue(next);
          setSourceLabel(null);
          void detectSource(next);
          setUrl("");
        }}>
          <input id="room-video-url" ref={inputRef} type="url" data-testid="queue-input" value={url} onChange={(event) => { setUrl(event.target.value); setBlocked(false); }} placeholder={t("queue.url")} aria-label={t("queue.url")} required />
          <button type="submit" data-testid="queue-add">{t("queue.add")}</button>
          {premiumGate && <small data-testid="premium-gate">{t("room.premiumNeeded")}</small>}
          {blocked && <small role="status" data-testid="premium-blocked">{t("room.premiumBlocked")}</small>}
          {sourceLabel && <small role="status" data-testid="queue-source">{sourceLabel}</small>}
        </form>
      </section>
      <section data-testid="queue-recommendations">
        <h3>{t("room.recommendations")}</h3>
        {recommendations.length ? <ol>{recommendations.map((item) => (
          <li className="room-queue-row" key={item.url} data-testid="queue-recommendation" data-url={item.url} data-reason={item.reason}>
            <b>{item.title ?? item.url}</b><small>{t(item.reason === "favorite" ? "room.favorite" : "room.history")}</small>
            <button type="button" data-testid="queue-recommendation-add" onClick={() => live.addQueue(item.url, item.title ?? undefined)}>{t("room.toQueue")}</button>
          </li>
        ))}</ol> : <p className="room-empty">{t("room.recommendationsEmpty")}</p>}
      </section>
      <section data-testid="queue-history">
        <h3>{t("room.historyTitle")} <small data-testid="queue-history-count">{meta.history.length}</small></h3>
        {live.state.self.role === "host" && meta.history.length > 0 && <button type="button" data-testid="history-clear" onClick={() => void meta.clearHistory()}>{t("room.clear")}</button>}
        {meta.history.length ? <ol>{meta.history.map((item) => (
          <li className="room-queue-row" key={item.id} data-testid="queue-history-item" data-url={item.url}>
            <b>{item.title ?? item.url}</b><button type="button" data-testid="history-reload" onClick={() => live.reloadHistory(item.id)}>{t("room.toQueue")}</button>
          </li>
        ))}</ol> : <p className="room-empty">{t("room.historyEmpty")}</p>}
      </section>
    </div>
  );
}
