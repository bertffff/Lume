import type { ReactNode } from "react";
import { useI18n } from "../i18n/context.js";

export function Skeleton({ rows = 3, label }: { rows?: number; label?: string }) {
  const { t } = useI18n();
  return (
    <div className="ui-skeleton" role="status" aria-label={label ?? t("common.loading")}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="ui-skeleton-line" style={{ width: `${92 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty" data-testid="empty-state">
      {icon ? <div className="ic" aria-hidden="true">{icon}</div> : null}
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {action ? <div className="ui-state-actions">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="empty" data-testid="error-state" role="alert">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {onRetry ? (
        <div className="ui-state-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {retryLabel ?? t("common.retry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
