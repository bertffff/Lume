import { type HTMLAttributes, type ReactNode } from "react";
import { type StyleId } from "./theme.js";
import { useI18n } from "../i18n/context.js";
import styles from "./StyleFrame.module.css";

export type StyleFrameScreen = "home" | "room" | "search" | "create" | "join" | "settings" | "profile" |
  "premium" | "auth" | "onboarding" | "notifications" | "missing" | "offline" | "unavailable" | "admin";

interface StyleFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "style"> {
  style: StyleId;
  screen: StyleFrameScreen;
  skipLink?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  status?: string;
}

const headerLayout: Record<StyleId, string | undefined> = {
  cinema: styles.contents,
  gruvbox: styles.terminal,
  telerave: styles.hub,
};

/** Only the frame chrome changes. Keep the supplied header and content subtree mounted. */
export function StyleFrame({
  style, screen, skipLink, header, footer, status, className, children, ...attributes
}: StyleFrameProps) {
  const { t } = useI18n();
  return (
    <div
      {...attributes}
      className={className}
      data-frame-style={style}
      data-view={screen}
    >
      {skipLink}
      <div className={header ? headerLayout[style] : styles.contents}>{header}</div>
      <div className={styles.contents}>{children}</div>
      <div className={styles.contents}>{footer}</div>
      {style === "gruvbox" && (
        <div className={styles.status}>
          <span className={styles.mode} title={t("frame.normal")}>NORMAL</span>
          <span>lume/{screen}</span>
          {status ? <span className={styles.detail}>{status}</span> : null}
        </div>
      )}
    </div>
  );
}
