import type { QueueItem } from "@lume/contracts";
import { ListVideo, Plus } from "lucide-react";
import { Button, Icon, Poster } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import styles from "./RoomQueuePreview.module.css";

export function roomClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const body = `${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

/** Up to two next videos and one way to add more; the full queue lives in the dock. */
export function RoomQueuePreview({ queue, onAdd }: { queue: readonly QueueItem[]; onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <section className={styles.root} data-testid="queue-preview">
      <div className={styles.heading}>
        <h2 className={styles.title}><Icon icon={ListVideo} size="sm" />{t("room.upNext")} <small className={styles.count}>{queue.length}</small></h2>
        <Button size="sm" icon={Plus} data-testid="queue-open-add" onClick={onAdd}>{t("people.request")}</Button>
      </div>
      {queue.length ? (
        <ol className={styles.list}>
          {queue.slice(0, 2).map((item) => (
            <li key={item.id} className={styles.item} data-testid="queue-preview-item">
              <Poster src={item.thumbnailUrl} category="other" className={styles.thumb} />
              <b className={styles.name} title={item.title}>{item.title}</b>
              {item.durationMs ? <small className={styles.duration}>{roomClock(item.durationMs)}</small> : null}
            </li>
          ))}
        </ol>
      ) : <p className={styles.empty}>{t("room.queueEmpty")}</p>}
    </section>
  );
}
