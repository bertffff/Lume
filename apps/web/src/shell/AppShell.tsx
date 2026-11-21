import type { ReactNode } from "react";

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
  return (
    <div className={`design-app app-shell ${className}`.trim()} data-view={view}>
      {header}
      <main className="app-shell-main">{children}</main>
      {footer}
    </div>
  );
}
