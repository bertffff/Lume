import type { ReactNode } from "react";
import { cx } from "../../ds/cx.js";
import styles from "./Pane.module.css";

/** A tmux pane: a one-line title with its window number, then the content. */
export function Pane({ index, title, meta, children, className, grow = false }: {
  index: number;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  grow?: boolean;
}) {
  return (
    <section className={cx(styles.pane, grow && styles.grow, className)} aria-label={title}>
      <header className={styles.title}>
        <span className={styles.index}>[{index}]</span>
        <span className={styles.name}>{title}</span>
        {meta !== undefined ? <span className={styles.meta}>{meta}</span> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
