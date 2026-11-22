import type { ReactNode } from "react";
import { Button } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import styles from "./Page.module.css";

/** A secondary screen: a back button on its own line, then the content filling the rest of the viewport. */
export function Page({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className={styles.root} data-page={title}>
      <div className={styles.head}>
        <Button size="sm" onClick={onClose} aria-label={t("page.back")}>{t("page.backShort")}</Button>
      </div>
      {children}
    </div>
  );
}
