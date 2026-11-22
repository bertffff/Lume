import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx.js";
import styles from "./Popover.module.css";

export interface PopoverTriggerProps {
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog";
}

export interface PopoverProps {
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  width?: "sm" | "md";
  defaultOpen?: boolean;
}

/** Anchored panel: closes on Esc and outside press, then returns focus to the trigger. */
export function Popover({ label, trigger, children, align = "end", width = "md", defaultOpen = false }: PopoverProps) {
  const [open, setOpen] = useState(defaultOpen);
  const anchor = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) anchor.current?.querySelector<HTMLElement>("button")?.focus();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    const onPress = (event: PointerEvent) => { if (!anchor.current?.contains(event.target as Node)) close(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [open]);

  return (
    <span ref={anchor} className={styles.anchor}>
      {trigger({ onClick: () => setOpen((value) => !value), "aria-expanded": open, "aria-controls": id, "aria-haspopup": "dialog" })}
      {open ? <div id={id} role="dialog" aria-label={label} className={cx(styles.panel, styles[align], styles[width])}>{children}</div> : null}
    </span>
  );
}
