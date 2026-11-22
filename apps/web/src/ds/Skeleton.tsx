import { cx } from "./cx.js";
import styles from "./Skeleton.module.css";

export type SkeletonShape = "line" | "title" | "block" | "circle" | "poster";

/** Placeholder while data loads. Decorative: the surrounding region carries aria-busy. */
export function Skeleton({ shape = "line", className }: { shape?: SkeletonShape; className?: string }) {
  return <span className={cx(styles.root, styles[shape], className)} aria-hidden="true" />;
}
