import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx.js";
import { Icon } from "./Icon.js";
import styles from "./Chip.module.css";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  selected?: boolean;
  icon?: LucideIcon;
  count?: number;
}

/** Filter/toggle chip: a real button with aria-pressed. */
export function Chip({ selected = false, icon, count, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={selected} className={cx(styles.root, selected && styles.selected, className)} {...rest}>
      {icon ? <Icon icon={icon} size="sm" /> : null}
      {children}
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </button>
  );
}

export function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="group" aria-label={label} className={styles.group}>{children}</div>;
}
