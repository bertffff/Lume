import { planPlayback, type QueueItem } from "@lume/contracts";
import { useState, type RefObject } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { useRoomMeta } from "../room/hooks/useRoomMeta.js";
import type { RoomActions } from "../room/live.js";
import { ChevronDown, ChevronUp, Play, X } from "lucide-react";
import { Button, IconButton, Input, Poster } from "../ds/index.js";
import { roomClock } from "./RoomQueuePreview.js";
import styles from "./RoomQueue.module.css";

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
    <div className={styles.root} data-testid="rail-queue">
      <section className={styles.section}>
        <h3 className={styles.heading}>{t("queue.now")}</h3>
        {now ? <div data-testid="queue-now" data-refresh-state={refreshing} className={styles.row}>
          <Poster src={now.thumbnailUrl} category="film" className={styles.thumb} /><b className={styles.name}>{now.title}</b>
          {refresh && <Button size="sm" variant="ghost" data-testid="queue-refresh" disabled={refreshing === "busy"} onClick={refresh}>{t(refreshing === "busy" ? "room.refreshing" : refreshing === "error" ? "room.refreshFailed" : "room.refreshLink")}</Button>}
        </div> : <p className={styles.empty}>{t("room.nothingPlaying")}</p>}
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>{t("room.upNext")} <small className={styles.count}>{queue.length}</small></h3>
        {queue.length ? <ol className={styles.list}>{queue.map((item, index) => (
          <li key={item.id} className={styles.row} data-testid="queue-item" data-url={item.url} data-provider={item.provider} data-title={item.title}>
            <Poster src={item.thumbnailUrl} category="other" className={styles.thumb} /><b className={styles.name}>{item.title}</b>
            {item.durationMs ? <small className={styles.count} data-testid="queue-item-duration" data-duration-ms={item.durationMs}>{roomClock(item.durationMs)}</small> : null}
            {live.canControl || item.addedById === live.selfId ? (
              <span className={styles.rowActions}>
                {live.canControl ? <IconButton icon={Play} size="sm" variant="ghost" label={t("queue.playNow")} data-testid="queue-play" onClick={() => live.playQueueItem(item.id)} /> : null}
                {live.canControl ? <IconButton icon={ChevronUp} size="sm" variant="ghost" label={t("queue.moveUp")} data-testid="queue-up" disabled={index === 0} onClick={() => live.moveQueueItem(item.id, "up")} /> : null}
                {live.canControl ? <IconButton icon={ChevronDown} size="sm" variant="ghost" label={t("queue.moveDown")} data-testid="queue-down" disabled={index === queue.length - 1} onClick={() => live.moveQueueItem(item.id, "down")} /> : null}
                <IconButton icon={X} size="sm" variant="ghost" label={t("queue.remove")} data-testid="queue-remove" onClick={() => live.removeQueueItem(item.id)} />
              </span>
            ) : null}
          </li>
        ))}</ol> : <p className={styles.empty}>{t("room.queueEmpty")}</p>}
        <form className={styles.add} onSubmit={(event) => {
          event.preventDefault();
          const next = url.trim();
          if (!next) return;
          if (premiumGate) { setBlocked(true); return; }
          live.addQueue(next);
          setSourceLabel(null);
          void detectSource(next);
          setUrl("");
        }}>
          <div className={styles.addField}><Input id="room-video-url" ref={inputRef} type="url" data-testid="queue-input" value={url} onChange={(event) => { setUrl(event.target.value); setBlocked(false); }} placeholder={t("queue.url")} aria-label={t("queue.url")} required /></div>
          <Button type="submit" variant="primary" data-testid="queue-add">{t("queue.add")}</Button>
          {premiumGate && <small className={styles.hint} data-testid="premium-gate">{t("room.premiumNeeded")}</small>}
          {blocked && <small className={styles.hint} role="status" data-testid="premium-blocked">{t("room.premiumBlocked")}</small>}
          {sourceLabel && <small className={styles.hint} role="status" data-testid="queue-source">{sourceLabel}</small>}
        </form>
      </section>
      <section className={styles.section} data-testid="queue-recommendations">
        <h3 className={styles.heading}>{t("room.recommendations")}</h3>
        {recommendations.length ? <ol className={styles.list}>{recommendations.map((item) => (
          <li className={styles.row} key={item.url} data-testid="queue-recommendation" data-url={item.url} data-reason={item.reason}>
            <b className={styles.name}>{item.title ?? item.url}</b><small className={styles.count}>{t(item.reason === "favorite" ? "room.favorite" : "room.history")}</small>
            <Button size="sm" data-testid="queue-recommendation-add" onClick={() => live.addQueue(item.url, item.title ?? undefined)}>{t("room.toQueue")}</Button>
          </li>
        ))}</ol> : <p className={styles.empty}>{t("room.recommendationsEmpty")}</p>}
      </section>
      <section className={styles.section} data-testid="queue-history">
        <h3 className={styles.heading}>{t("room.historyTitle")} <small className={styles.count} data-testid="queue-history-count">{meta.history.length}</small></h3>
        {live.state.self.role === "host" && meta.history.length > 0 && <Button size="sm" variant="ghost" data-testid="history-clear" onClick={() => void meta.clearHistory()}>{t("room.clear")}</Button>}
        {meta.history.length ? <ol className={styles.list}>{meta.history.map((item) => (
          <li className={styles.row} key={item.id} data-testid="queue-history-item" data-url={item.url}>
            <b className={styles.name}>{item.title ?? item.url}</b><Button size="sm" data-testid="history-reload" onClick={() => live.reloadHistory(item.id)}>{t("room.toQueue")}</Button>
          </li>
        ))}</ol> : <p className={styles.empty}>{t("room.historyEmpty")}</p>}
      </section>
    </div>
  );
}
