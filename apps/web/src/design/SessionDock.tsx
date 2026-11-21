import { ListVideo, MessageCircle, UsersRound, X } from "lucide-react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "../i18n/context.js";

const tabs = ["chat", "people", "queue"] as const;
export type DockTab = (typeof tabs)[number];
const labels = { chat: "chat.title", people: "room.people", queue: "room.queueTitle" } as const;
const icons = { chat: MessageCircle, people: UsersRound, queue: ListVideo };

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
    <aside className="room-dock" data-testid="session-dock" data-role={role} data-open={open} aria-label={t("room.session")}>
      <div className="room-dock-heading">
        <div className="room-tabs" role="tablist" aria-label={t("room.panels")}>
          {tabs.map((item) => {
            const Icon = icons[item];
            return (
              <button key={item} type="button" role="tab" ref={(element) => { tabRefs.current[item] = element; }}
                id={`${id}-${item}-tab`} aria-controls={`${id}-${item}`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1}
                data-testid={`session-dock-${item}`} onClick={() => onTab(item)} onKeyDown={(event) => move(event, item)}>
                <Icon aria-hidden="true" /><span>{t(labels[item])}</span>{counts[item] > 0 ? <small>{counts[item]}</small> : null}
              </button>
            );
          })}
        </div>
        <button className="room-dock-close" type="button" data-testid="mobile-sheet-close" aria-label={t("common.close")} onClick={onClose}><X aria-hidden="true" /></button>
      </div>
      {tabs.map((item) => (
        <div key={item} role="tabpanel" id={`${id}-${item}`} aria-labelledby={`${id}-${item}-tab`} hidden={tab !== item} className={`room-dock-panel room-dock-${item}`}>
          {panels[item]}
        </div>
      ))}
    </aside>
  );
}
