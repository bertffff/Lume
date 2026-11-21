import type { ReactNode } from "react";
import { useI18n } from "../i18n/context.js";

/** One frame for every product surface: admin, room, home and pages. */
export function AppShell({
  view,
  className = "",
  header,
  footer,
  children,
}: {
  view?: string;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className={`design-app app-shell ${className}`.trim()} data-view={view}>
      <a className="skip-link" href="#app-main">
        {t("a11y.skip")}
      </a>
      {header}
      <main id="app-main" className="app-shell-main">{children}</main>
      {footer}
    </div>
  );
}
