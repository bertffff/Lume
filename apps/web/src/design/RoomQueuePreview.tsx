import type { QueueItem } from "@lume/contracts";
import { ListVideo, Plus } from "lucide-react";
import { useI18n } from "../i18n/context.js";
import { posterStyle } from "./posters.js";

export function roomClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const body = `${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

export function RoomQueuePreview({ queue, onAdd }: { queue: readonly QueueItem[]; onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <section className="room-queue-preview room-card" data-testid="queue-preview">
      <div className="room-card-heading">
        <h2><ListVideo aria-hidden="true" />{t("room.upNext")} <small>{queue.length}</small></h2>
        <button type="button" data-testid="queue-open-add" onClick={onAdd}><Plus aria-hidden="true" />{t("people.request")}</button>
      </div>
      {queue.length ? (
        <ol className="room-queue-preview-list">
          {queue.slice(0, 2).map((item) => (
            <li key={item.id} data-testid="queue-preview-item">
              <span className="room-thumbnail" aria-hidden="true" style={posterStyle(item.id, item.thumbnailUrl)} />
              <b title={item.title}>{item.title}</b>
              {item.durationMs ? <small>{roomClock(item.durationMs)}</small> : null}
            </li>
          ))}
        </ol>
      ) : <p className="room-empty">{t("room.queueEmpty")}</p>}
    </section>
  );
}
