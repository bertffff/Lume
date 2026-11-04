import { useState, type FormEvent } from "react";
import { useI18n } from "../../i18n/context.js";
import { useRoomActions } from "../../room/live.js";

export function QueuePanel({
  collapsed,
  collapsible,
  onToggle,
}: {
  collapsed: boolean;
  collapsible: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const live = useRoomActions();
  const [url, setUrl] = useState("");

  if (collapsed) {
    return (
      <button type="button" className="tr-rail" onClick={onToggle}>
        {t("queue.title")}
      </button>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = url.trim();
    if (!next || !live) {
      return;
    }
    live.addQueue(next);
    setUrl("");
  }

  const items = live?.state.queue ?? [];
  const currentId = live?.state.room.nowPlaying?.id;

  return (
    <section className="tr-panel" aria-label={t("queue.title")}>
      <header className="tr-panel-bar">
        <span>{t("queue.title")}</span>
        {collapsible ? (
          <button type="button" className="tr-text-button" onClick={onToggle}>
            {t("layout.collapse")}
          </button>
        ) : null}
      </header>
      {items.length === 0 ? <p className="tr-empty">{t("queue.empty")}</p> : null}
      <ol className="tr-queue">
        {items.map((item) => (
          <li key={item.id} className={item.id === currentId ? "is-current" : undefined}>
            <span>{item.id === currentId ? t("queue.nowPlaying") : item.provider}</span>
            {item.title}
          </li>
        ))}
      </ol>
      <form className="tr-composer" onSubmit={submit}>
        <input
          data-testid="queue-input"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("queue.url")}
          aria-label={t("queue.url")}
        />
        <button type="submit" data-testid="queue-add">
          {t("queue.add")}
        </button>
      </form>
      {live?.canControl ? (
        <footer className="tr-panel-bar">
          <button type="button" className="tr-text-button" data-testid="queue-next" onClick={live.playNext}>
            {t("queue.next")}
          </button>
        </footer>
      ) : null}
    </section>
  );
}
