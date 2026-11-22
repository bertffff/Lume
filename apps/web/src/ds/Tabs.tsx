import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx.js";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  panel: ReactNode;
}

export interface TabsProps {
  label: string;
  tabs: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
}

/** WAI-ARIA tabs: arrows, Home and End move focus and selection; only the active panel is mounted. */
export function Tabs({ label, tabs, value, defaultValue, onChange }: TabsProps) {
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id ?? "");
  const active = value ?? inner;
  const base = useId();
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const select = (id: string) => {
    setInner(id);
    onChange?.(id);
    refs.current.get(id)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const target = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : step ? (index + step + tabs.length) % tabs.length : -1;
    if (target < 0) return;
    event.preventDefault();
    const next = tabs[target];
    if (next) select(next.id);
  };

  return (
    <div className={styles.root}>
      <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(node) => { if (node) refs.current.set(tab.id, node); }}
            id={`${base}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            className={cx(styles.tab, active === tab.id && styles.active)}
            onClick={() => select(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined ? <span className={styles.count}>{tab.count}</span> : null}
          </button>
        ))}
      </div>
      {tabs.map((tab) => active === tab.id ? (
        <div key={tab.id} role="tabpanel" id={`${base}-panel-${tab.id}`} aria-labelledby={`${base}-tab-${tab.id}`} tabIndex={0} className={styles.panel}>{tab.panel}</div>
      ) : null)}
    </div>
  );
}
