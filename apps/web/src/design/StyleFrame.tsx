import { type HTMLAttributes, type ReactNode } from "react";
import { type StyleId } from "./theme.js";
import { useI18n } from "../i18n/context.js";

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

const headerLayout: Record<StyleId, string> = {
  cinema: "contents",
  gruvbox: "style-frame-terminal min-w-0",
  telerave: "style-frame-legacy sticky top-3 z-20 mx-3 rounded-2xl md:top-4 md:mx-4",
};

/** Only the frame chrome changes. Keep the supplied header and content subtree mounted. */
export function StyleFrame({
  style, screen, skipLink, header, footer, status, className, children, ...attributes
}: StyleFrameProps) {
  const { t } = useI18n();
  return (
    <div
      {...attributes}
      className={className ? `style-frame ${className}` : "style-frame"}
      data-frame-style={style}
      data-view={screen}
    >
      {skipLink}
      <div className={header ? headerLayout[style] : "contents"}>{header}</div>
      <div className="style-frame-content contents">{children}</div>
      <div className="contents">{footer}</div>
      {style === "gruvbox" && (
        <div className="style-frame-status flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs">
          <span className="style-frame-status-label px-2" title={t("frame.normal")}>NORMAL</span>
          <span>lume/{screen}</span>
          {status ? <span className="style-frame-status-detail">{status}</span> : null}
        </div>
      )}
    </div>
  );
}
