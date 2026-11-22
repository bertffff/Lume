import { ListVideo, MessageCircle, UsersRound, X } from "lucide-react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon, IconButton } from "../ds/index.js";
import { cx } from "../ds/cx.js";
import { useI18n } from "../i18n/context.js";
import styles from "./SessionDock.module.css";

const tabs = ["chat", "people", "queue"] as const;
export type DockTab = (typeof tabs)[number];
const labels = { chat: "chat.title", people: "room.people", queue: "room.queueTitle" } as const;
const icons = { chat: MessageCircle, people: UsersRound, queue: ListVideo };

/** The single right-hand panel: Chat, People and Queue as WAI-ARIA tabs. */
export function SessionDock({ tab, onTab, panels, counts, role, open, onClose }: {
  tab: DockTab;
  onTab: (tab: DockTab) => void;
  panels: Record<DockTab, ReactNode>;
  counts: Record<DockTab, number>;
  role: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const tabRefs = useRef<Partial<Record<DockTab, HTMLButtonElement | null>>>({});

  function move(event: KeyboardEvent, current: DockTab) {
    const index = tabs.indexOf(current);
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[2]
      : event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length]
      : event.key === "ArrowLeft" ? tabs[(index + tabs.length - 1) % tabs.length] : undefined;
    if (!next) return;
    event.preventDefault();
    onTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <aside className={styles.root} data-testid="session-dock" data-role={role} data-open={open} aria-label={t("room.session")}>
      <div className={styles.heading}>
        <div className={styles.tabs} role="tablist" aria-label={t("room.panels")}>
          {tabs.map((item) => (
            <button key={item} type="button" role="tab" ref={(element) => { tabRefs.current[item] = element; }}
              className={cx(styles.tab, tab === item && styles.active)}
              id={`${id}-${item}-tab`} aria-controls={`${id}-${item}`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1}
              data-testid={`session-dock-${item}`} onClick={() => onTab(item)} onKeyDown={(event) => move(event, item)}>
              <Icon icon={icons[item]} size="sm" /><span>{t(labels[item])}</span>{counts[item] > 0 ? <small className={styles.count}>{counts[item]}</small> : null}
            </button>
          ))}
        </div>
        <IconButton className={styles.close} icon={X} size="sm" variant="ghost" label={t("common.close")} data-testid="mobile-sheet-close" onClick={onClose} />
      </div>
      {tabs.map((item) => (
        <div key={item} role="tabpanel" id={`${id}-${item}`} aria-labelledby={`${id}-${item}-tab`} hidden={tab !== item} className={styles.panel}>
          {panels[item]}
        </div>
      ))}
    </aside>
  );
}
