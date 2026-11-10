import { moveQueueItem } from "@lume/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { apiUrl } from "../../api/client.js";
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
  const [pending, setPending] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; title: string | null; url: string }>>([]);
  const [tips, setTips] = useState<Array<{ url: string; title: string | null; reason: string }>>([]);
  const [found, setFound] = useState<Array<{ title: string; url: string }>>([]);
  const [search, setSearch] = useState("");
  const roomId = live?.state.room.id;
  const token = live?.accessToken;

  useEffect(() => {
    if (!live) return;
    if (live.state.queue.some((item) => item.url === pending)) setPending(null);
  }, [live, pending]);

  useEffect(() => {
    if (!roomId || !token) return;
    void fetch(`${apiUrl}/rooms/${roomId}/history`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { history?: Array<{ id: string; title: string | null; url: string }> }) => setHistory(payload.history ?? []))
      .catch(() => setHistory([]));
    void fetch(`${apiUrl}/me/discovery`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { items?: Array<{ url: string; title: string | null; reason: string }> }) => setTips(payload.items ?? []))
      .catch(() => setTips([]));
  }, [roomId, token]);

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
    setPending(next);
    live.addQueue(next);
    setUrl("");
  }

  function reorder(id: string, direction: -1 | 1) {
    if (!live) return;
    const ids = moveQueueItem(live.state.queue.map((item) => item.id), id, direction);
    void fetch(`${apiUrl}/rooms/${live.state.room.id}/queue/order`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${live.accessToken}` },
      body: JSON.stringify({ ids }),
    });
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
      {items.length === 0 && !pending ? <p className="tr-empty">{t("queue.empty")}</p> : null}
      {pending ? <p data-testid="queue-pending">{pending}</p> : null}
      <ol className="tr-queue">
        {items.map((item) => (
          <li key={item.id} className={item.id === currentId ? "is-current" : undefined}>
            {item.thumbnailUrl ? <img className="tr-thumb" src={item.thumbnailUrl} alt="" /> : null}
            <span>{item.id === currentId ? t("queue.nowPlaying") : item.provider}</span>
            {item.title}
            <button type="button" className="tr-text-button" aria-label={t("queue.up")} onClick={() => reorder(item.id, -1)}>↑</button>
            <button type="button" className="tr-text-button" aria-label={t("queue.down")} onClick={() => reorder(item.id, 1)}>↓</button>
          </li>
        ))}
      </ol>
      <form className="tr-composer" onSubmit={(event) => {
        event.preventDefault();
        const q = search.trim();
        if (!q) return;
        void fetch(`${apiUrl}/video/search?q=${encodeURIComponent(q)}`).then((response) => response.json()).then((payload: { results?: Array<{ title: string; url: string }> }) => setFound(payload.results ?? []));
      }}>
        <input aria-label={t("queue.search")} placeholder={t("queue.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
      </form>
      {found.map((item) => <button key={item.url} type="button" className="tr-text-button" onClick={() => live?.addQueue(item.url)}>{item.title || item.url}</button>)}
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
      {history.length > 0 ? (
        <ul>
          {history.map((item) => (
            <li key={item.id}>{item.title || item.url}</li>
          ))}
        </ul>
      ) : null}
      {tips.length > 0 ? <p className="tr-note">{t("queue.tips")} {tips[0]?.title ?? tips[0]?.url}</p> : null}
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
