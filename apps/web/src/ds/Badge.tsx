import type { ReactNode } from "react";
import { cx } from "./cx.js";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "accent" | "success" | "warn" | "danger" | "info" | "media";

/** Small status label. Tone colours text and tint only; it never fills a large surface. */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx(styles.root, styles[tone])}>{children}</span>;
}

export function StatusDot({ tone, label }: { tone: Exclude<BadgeTone, "neutral" | "accent" | "media">; label: string }) {
  return <span className={cx(styles.dot, styles[`dot-${tone}`])} role="img" aria-label={label} />;
}
