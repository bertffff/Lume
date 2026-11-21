import type { ReactNode } from "react";

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  "data-testid": testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? "toggle on" : "toggle"}
      data-testid={testId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <i aria-hidden="true" />
    </button>
  );
}

export type BadgeTone = "neutral" | "accent" | "social" | "ok" | "danger";

export function Badge({
  tone = "neutral",
  count,
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  count?: number;
  dot?: boolean;
  children?: ReactNode;
}) {
  if (dot) {
    return <span className={`ui-badge-dot ui-badge-${tone}`} aria-hidden="true" />;
  }
  const value = count === undefined ? children : count > 99 ? "99+" : String(count);
  return (
    <span className={`ui-badge ui-badge-${tone}`} data-count={count}>
      {value}
    </span>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title || action ? (
        <h3 className="ct">
          {title}
          {action ? <span className="ui-card-action">{action}</span> : null}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
