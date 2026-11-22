import type { ReactNode } from "react";
import { State } from "../../ds/index.js";
import styles from "./EmptyScreen.module.css";

export function EmptyScreen({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className={styles.root}><State kind="empty" title={title} body={body} action={action} /></div>;
}
