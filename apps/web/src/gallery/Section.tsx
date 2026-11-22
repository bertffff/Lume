import type { ReactNode } from "react";
import { cx } from "../ds/cx.js";
import styles from "./gallery.module.css";

export function Section({ title, note, wide = false, children }: { title: string; note?: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={cx(styles.section, wide && styles.wide)}>
      <h2 className={styles.h2}>{title}</h2>
      {note ? <p className={styles.note}>{note}</p> : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
