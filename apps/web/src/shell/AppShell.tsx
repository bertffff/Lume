import type { ReactNode } from "react";
import { StyleFrame, type StyleFrameScreen } from "../design/StyleFrame.js";
import type { StyleId } from "../design/theme.js";
import { useI18n } from "../i18n/context.js";

/** One frame for every product surface: admin, room, home and pages. */
export function AppShell({
  view = "home",
  style = "cinema",
  className = "",
  header,
  footer,
  children,
}: {
  view?: StyleFrameScreen;
  style?: StyleId;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <StyleFrame
      className={`design-app app-shell ${className}`.trim()}
      screen={view}
      style={style}
      skipLink={<a className="skip-link" href="#app-main">{t("a11y.skip")}</a>}
      header={header}
      footer={footer}
    >
      <main id="app-main" className="app-shell-main">{children}</main>
    </StyleFrame>
  );
}
