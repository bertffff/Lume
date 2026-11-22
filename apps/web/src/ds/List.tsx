import type { ReactNode } from "react";
import { cx } from "./cx.js";
import styles from "./List.module.css";

export function List({ label, children, dividers = true }: { label: string; children: ReactNode; dividers?: boolean }) {
  return <ul className={cx(styles.list, dividers && styles.dividers)} aria-label={label}>{children}</ul>;
}

export interface ListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}

/** One row. With `onSelect` the whole row is a button; trailing actions stay outside it. */
export function ListRow({ leading, title, subtitle, trailing, selected = false, onSelect }: ListRowProps) {
  const body = (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
    </>
  );
  return (
    <li className={cx(styles.row, selected && styles.selected)}>
      {onSelect ? <button type="button" className={cx(styles.main, styles.button)} onClick={onSelect} aria-current={selected || undefined}>{body}</button> : <div className={styles.main}>{body}</div>}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </li>
  );
}
