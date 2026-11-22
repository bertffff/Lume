import { cx } from "./cx.js";
import styles from "./Progress.module.css";

export interface ProgressProps {
  /** 0–1. `null` means the length is unknown: nothing is drawn rather than invented. */
  value: number | null;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Native <progress>: width comes from `value`, so no inline style is needed. */
export function Progress({ value, label, size = "sm", className }: ProgressProps) {
  if (value === null) return null;
  return <progress className={cx(styles.root, styles[size], className)} aria-label={label} max={1} value={Math.min(1, Math.max(0, value))} />;
}
