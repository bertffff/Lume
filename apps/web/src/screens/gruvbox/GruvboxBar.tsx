import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "../../ds/index.js";
import { cx } from "../../ds/cx.js";
import type { View } from "../../design/DesignApp.js";
import { useI18n } from "../../i18n/context.js";
import styles from "./GruvboxBar.module.css";

const tabs: ReadonlyArray<[View, string]> = [["home", "home"], ["search", "search"], ["room", "room"], ["profile", "profile"]];

/** The terminal's buffer line: LUME, numbered windows, a search stub and the usual actions. */
export function GruvboxBar({ view, onGo, searchLabel, actions, light, onToggleTheme, themeLabel }: {
  view: View;
  onGo: (path: string) => void;
  searchLabel: string;
  actions: ReactNode;
  light: boolean;
  onToggleTheme: () => void;
  themeLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.root}>
      <span className={styles.brand}><i className={styles.dot} />LUME</span>
      <nav className={styles.bufs} aria-label={t("shell.navigation")}>
        {tabs.map(([id, label], index) => (
          <button key={id} type="button" className={cx(styles.buf, view === id && styles.on)} aria-current={view === id ? "page" : undefined} onClick={() => onGo(id === "home" ? "/" : `/${id}`)}>
            <span className={styles.nr}>{index + 1}</span>{label}
          </button>
        ))}
      </nav>
      <label className={styles.search}><input aria-label={searchLabel} placeholder={searchLabel} onFocus={() => onGo("/search")} /></label>
      <div className={styles.actions}>
        {actions}
        <IconButton icon={light ? Moon : Sun} label={themeLabel} variant="ghost" onClick={onToggleTheme} />
      </div>
    </div>
  );
}
