import { Bell, House, Search, UserRound, type LucideIcon } from "lucide-react";
import { Icon } from "../ds/index.js";
import { cx } from "../ds/cx.js";
import { useI18n } from "../i18n/context.js";
import type { MessageKey } from "../i18n/ru.js";
import styles from "./BottomNav.module.css";

type Destination = "home" | "search" | "notifications" | "profile";

const items: Array<{ id: Destination; path: string; icon: LucideIcon; label: MessageKey }> = [
  { id: "home", path: "/", icon: House, label: "nav.home" },
  { id: "search", path: "/search", icon: Search, label: "nav.search" },
  { id: "notifications", path: "/notifications", icon: Bell, label: "nav.events" },
  { id: "profile", path: "/profile", icon: UserRound, label: "nav.me" },
];

/** Phone-only tab bar. It owns its own height so pages can reserve it without guessing. */
export function BottomNav({ current, onGo }: { current: string; onGo: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <nav className={styles.root} aria-label={t("nav.main")}>
      {items.map(({ id, path, icon, label }) => (
        <button key={id} type="button" className={cx(styles.item, current === id && styles.active)} aria-current={current === id ? "page" : undefined} onClick={() => onGo(path)}>
          <Icon icon={icon} size="md" />
          <span>{t(label)}</span>
        </button>
      ))}
    </nav>
  );
}
