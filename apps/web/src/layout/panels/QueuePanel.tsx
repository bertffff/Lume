import { useI18n } from "../../i18n/context.js";
import type { MessageKey } from "../../i18n/ru.js";

const items: MessageKey[] = ["queue.item1", "queue.item2", "queue.item3"];

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
  if (collapsed) {
    return (
      <button type="button" className="tr-rail" onClick={onToggle}>
        {t("queue.title")}
      </button>
    );
  }

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
      <ol className="tr-queue">
        {items.map((key, index) => (
          <li key={key} className={index === 0 ? "is-current" : undefined}>
            <span>{index === 0 ? t("queue.now") : t("queue.next")}</span>
            {t(key)}
          </li>
        ))}
      </ol>
    </section>
  );
}
