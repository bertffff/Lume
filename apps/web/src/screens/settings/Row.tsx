import type { ReactNode } from "react";
import styles from "./SettingsScreen.module.css";

/** One setting: what it is and why on the left, the control on the right (below on phones). */
export function Row({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <b className={styles.name}>{title}</b>
        {hint ? <small className={styles.hint}>{hint}</small> : null}
      </div>
      {children ? <div className={styles.control}>{children}</div> : null}
    </div>
  );
}
