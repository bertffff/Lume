import { CloudOff, DoorClosed, Inbox, Lock, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx.js";
import { Icon } from "./Icon.js";
import styles from "./State.module.css";

export type StateKind = "empty" | "error" | "offline" | "forbidden" | "missing";

const glyphs: Record<StateKind, LucideIcon> = { empty: Inbox, error: TriangleAlert, offline: CloudOff, forbidden: Lock, missing: DoorClosed };

export interface StateProps {
  kind: StateKind;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
  /** No border or background: for a state that already sits inside a card. */
  bare?: boolean;
}

/**
 * One block for "nothing here", "failed", "offline", "no access" and "not found".
 * Errors use role=alert; the rest are quiet. Every state names what happened and offers the next step.
 */
export function State({ kind, title, body, action, compact = false, bare = false }: StateProps) {
  return (
    <div className={cx(styles.root, styles[kind], compact && styles.compact, bare && styles.bare)} role={kind === "error" ? "alert" : "status"}>
      <span className={styles.glyph}><Icon icon={glyphs[kind]} size="lg" /></span>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        {body ? <p className={styles.body}>{body}</p> : null}
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </div>
  );
}
