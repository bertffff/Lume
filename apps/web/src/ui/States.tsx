import type { ReactNode } from "react";

export function Skeleton({ rows = 3, label = "Загрузка" }: { rows?: number; label?: string }) {
  return (
    <div className="ui-skeleton" role="status" aria-label={label}>
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
  retryLabel = "Повторить",
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="empty" data-testid="error-state" role="alert">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {onRetry ? (
        <div className="ui-state-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
