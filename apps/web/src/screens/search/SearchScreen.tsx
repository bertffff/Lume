import { detectSource } from "@lume/contracts";
import { Copy, ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { Button, Card, Chip, ChipGroup, Input, List, ListRow, State } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import styles from "./SearchScreen.module.css";

const sources = ["all", "youtube", "vk", "rutube", "direct"] as const;
type Source = (typeof sources)[number];
interface Result { title: string; url: string }

/** Video search: one query, source filters, honest result rows (no invented thumbnails), and a direct-link box. */
export function SearchScreen({ apiUrl, query, onQuery }: { apiUrl: string; query: string; onQuery: (value: string) => void }) {
  const { t } = useI18n();
  const [found, setFound] = useState<Result[] | null>(null);
  const [tab, setTab] = useState<Source>("all");
  const [busy, setBusy] = useState(false);
  const shown = (found ?? []).filter((item) => tab === "all" || (detectSource(item.url)?.id ?? "direct") === tab);

  async function run() {
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/video/search?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { results?: Result[] };
      setFound(payload.results ?? []);
    } catch {
      setFound([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.root}>
      <Card as="section" pad="lg" className={styles.panel} aria-label={t("search.title")}>
        <h1 className={styles.title}>{t("search.title")}</h1>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void run(); }}>
          <div className={styles.grow}>
            <Input icon={Search} value={query} onChange={(event) => onQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} autoFocus />
          </div>
          <Button type="submit" variant="primary" loading={busy}>{t("profile.search")}</Button>
        </form>
        <ChipGroup label={t("search.sources")}>
          {sources.map((source) => <Chip key={source} selected={tab === source} onClick={() => setTab(source)}>{t(`search.source.${source}`)}</Chip>)}
        </ChipGroup>
        {found === null || shown.length === 0 ? (
          <State kind="empty" compact bare title={t("search.empty")} />
        ) : (
          <List label={t("search.title")}>
            {shown.map((item) => (
              <ListRow
                key={item.url}
                title={item.title || item.url}
                subtitle={detectSource(item.url)?.id ?? t("search.source.direct")}
                trailing={
                  <span className={styles.actions}>
                    <Button size="sm" variant="primary" icon={ExternalLink} onClick={() => window.open(item.url, "_blank", "noopener")}>{t("search.play")}</Button>
                    <Button size="sm" icon={Copy} onClick={() => void navigator.clipboard?.writeText(item.url)}>{t("search.copy")}</Button>
                  </span>
                }
              />
            ))}
          </List>
        )}
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            const url = String(new FormData(event.currentTarget).get("url") ?? "").trim();
            if (url) window.open(url, "_blank", "noopener");
          }}
        >
          <div className={styles.grow}><Input name="url" icon={ExternalLink} placeholder={t("search.directPlaceholder")} aria-label={t("search.directPlaceholder")} /></div>
          <Button type="submit">{t("search.open")}</Button>
        </form>
      </Card>
    </div>
  );
}
