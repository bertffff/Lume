import { Moon, Search, Sun } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Avatar, Icon, IconButton } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import styles from "./AppHeader.module.css";

export interface AppHeaderProps {
  searchLabel: string;
  query: string;
  onQuery: (value: string) => void;
  onSearchFocus: () => void;
  onHome: () => void;
  /** Notification control and any other trailing actions. */
  actions?: ReactNode;
  theme: "dark" | "light";
  themeLabel: string;
  onToggleTheme: () => void;
  profileName: string;
  /** Signed-out label shown instead of a name. */
  signInLabel: string;
  signedIn: boolean;
  onProfile: () => void;
}

export function AppHeader({
  searchLabel, query, onQuery, onSearchFocus, onHome, actions, theme, themeLabel, onToggleTheme,
  profileName, signInLabel, signedIn, onProfile,
}: AppHeaderProps) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const firstName = profileName.split(/\s+/)[0] ?? profileName;
  return (
    <header className={styles.root}>
      <div className={styles.inner}>
        <button type="button" className={styles.logo} onClick={onHome} aria-label="lume">
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.word}>lume</span>
        </button>
        <label className={styles.search}>
          <Icon icon={Search} size="md" className={styles.searchIcon} />
          <input
            ref={input}
            className={styles.input}
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            onFocus={onSearchFocus}
          />
          <kbd className={styles.kbd} title={t("shell.searchShortcut")}>/</kbd>
        </label>
        <div className={styles.actions}>
          {actions}
          <IconButton icon={theme === "dark" ? Sun : Moon} label={themeLabel} variant="ghost" className={styles.theme} onClick={onToggleTheme} />
          <button type="button" className={styles.profile} onClick={onProfile}>
            <Avatar name={signedIn ? profileName : signInLabel} size="sm" />
            <span className={styles.name}>{signedIn ? firstName : signInLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
