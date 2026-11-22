import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";
import styles from "./Card.module.css";

export type CardTone = "flat" | "raised" | "accent";
export type CardPad = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: CardTone;
  pad?: CardPad;
  interactive?: boolean;
  /** Only meaningful with as="button". */
  type?: "button" | "submit";
  children?: ReactNode;
}

/** Surface container. `flat` = surface-1, `raised` = surface-2, `accent` = the one filled accent block per screen. */
export function Card({ as: Tag = "div", tone = "flat", pad = "md", interactive = false, className, children, ...rest }: CardProps) {
  return <Tag className={cx(styles.root, styles[tone], styles[`pad-${pad}`], interactive && styles.interactive, className)} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, action, meta }: { title: ReactNode; action?: ReactNode; meta?: ReactNode }) {
  return (
    <div className={styles.header}>
      <h3 className={styles.title}>{title}</h3>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
