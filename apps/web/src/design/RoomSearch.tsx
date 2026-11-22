import { Search } from "lucide-react";
import { useState } from "react";
import { apiUrl } from "../api/client.js";
import { Button, Input, List, ListRow } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import type { RoomActions } from "../room/live.js";
import styles from "./RoomQueue.module.css";

interface Result { title: string; url: string }

/** Search for a video without leaving the room; a result goes straight to the queue. */
export function RoomSearch({ live }: { live: RoomActions }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());

  async function run() {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/video/search?q=${encodeURIComponent(query.trim())}`);
      const payload = (await response.json()) as { results?: Result[] };
      setResults((payload.results ?? []).slice(0, 6));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} data-testid="room-search">
      <h3 className={styles.heading}>{t("search.title")}</h3>
      <form className={styles.add} onSubmit={(event) => { event.preventDefault(); void run(); }}>
        <div className={styles.addField}>
          <Input icon={Search} data-testid="room-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} />
        </div>
        <Button type="submit" loading={busy}>{t("profile.search")}</Button>
      </form>
      {results === null ? null : results.length === 0 ? <p className={styles.empty}>{t("search.empty")}</p> : (
        <List label={t("search.title")}>
          {results.map((item) => (
            <ListRow
              key={item.url}
              attrs={{ "data-testid": "room-search-result", "data-url": item.url }}
              title={item.title || item.url}
              trailing={
                <Button size="sm" variant="primary" data-testid="room-search-add" disabled={added.has(item.url)} onClick={() => { live.addQueue(item.url, item.title || undefined); setAdded((current) => new Set(current).add(item.url)); }}>
                  {t("room.toQueue")}
                </Button>
              }
            />
          ))}
        </List>
      )}
    </section>
  );
}
