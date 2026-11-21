import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./notification-inbox.css";

export type NotificationInboxItem = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  markingRead?: boolean;
  icon?: ReactNode;
  timestamp?: { dateTime: string; label: string } | null;
  action?: { label: string; onSelect: (id: string) => void };
};

export type NotificationInboxLabels = {
  title: string;
  unreadCount: (count: number) => string;
  read: string;
  unread: string;
  markRead: string;
  markAllRead: string;
  empty: string;
  loading: string;
  error: string;
  retry: string;
};

export type NotificationInboxProps = {
  items: readonly NotificationInboxItem[];
  unreadCount: number | null;
  icon: ReactNode;
  labels: NotificationInboxLabels;
  status?: "ready" | "loading" | "error";
  markingAllRead?: boolean;
  mutationError?: string | null;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onRetry?: () => void;
};

export type NotificationInboxPopoverProps = NotificationInboxProps & {
  viewAllLabel: string;
  onOpenAll: () => void;
};

export function NotificationInboxPopover({ viewAllLabel, onOpenAll, ...inbox }: NotificationInboxPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const countId = `${id}-count`;
  const headingId = `${id}-heading`;
  const { unreadCount, labels } = inbox;
  const unreadDescription = unreadCount !== null && unreadCount > 0 ? labels.unreadCount(unreadCount) : null;

  function dismiss() {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!open || !trigger || !panel) return;

    // Keep the panel aligned to the bell while CSS clamps it to the viewport.
    const position = () => {
      const anchor = rootRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      panel.style.setProperty("--notification-viewport-width", `${viewportWidth}px`);
      panel.style.setProperty("--notification-anchor-left", `${anchor.left}px`);
      panel.style.setProperty("--notification-anchor-width", `${anchor.width}px`);
      panel.style.setProperty("--notification-anchor-bottom", `${anchor.bottom}px`);
    };
    position();
    panel.focus({ preventScroll: true });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !event.composedPath().includes(rootRef.current)) dismiss();
    };
    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, [open]);

  return (
    <div
      className="notification-inbox-anchor"
      ref={rootRef}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
    >
      <button
        type="button"
        className="notification-inbox-button notification-inbox-trigger"
        ref={triggerRef}
        aria-label={inbox.labels.title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={unreadDescription !== null ? countId : undefined}
        onClick={() => open ? dismiss() : setOpen(true)}
      >
        <span className="notification-inbox-icon" aria-hidden="true">{inbox.icon}</span>
        {unreadDescription !== null && <>
          <span className="notification-inbox-badge" aria-hidden="true" />
          <span id={countId} hidden>{unreadDescription}</span>
        </>}
      </button>
      {open && (
        <div
          className="notification-inbox notification-inbox-popover"
          id={id}
          role="dialog"
          aria-labelledby={headingId}
          ref={panelRef}
          tabIndex={-1}
        >
          <header className="notification-inbox-header">
            <div>
              <h2 id={headingId}>{inbox.labels.title}</h2>
              <InboxCount {...inbox} />
            </div>
            <div className="notification-inbox-header-actions">
              <button type="button" className="notification-inbox-button" onClick={() => {
                dismiss();
                onOpenAll();
              }}>{viewAllLabel}</button>
              <InboxMarkAll {...inbox} />
            </div>
          </header>
          <InboxFeed {...inbox} heading="h3" onNavigate={dismiss} />
        </div>
      )}
    </div>
  );
}

export function NotificationInboxPage(inbox: NotificationInboxProps) {
  const headingId = useId();
  return (
    <section className="notification-inbox notification-inbox-page" aria-labelledby={headingId}>
      <header className="notification-inbox-header">
        <div>
          <h1 id={headingId}>{inbox.labels.title}</h1>
          <InboxCount {...inbox} />
        </div>
        <InboxMarkAll {...inbox} />
      </header>
      <InboxFeed {...inbox} heading="h2" />
    </section>
  );
}

function InboxCount({ unreadCount, labels }: Pick<NotificationInboxProps, "unreadCount" | "labels">) {
  return (
    <p className="notification-inbox-count" aria-live="polite">
      {unreadCount !== null ? labels.unreadCount(unreadCount) : null}
    </p>
  );
}

function InboxMarkAll({ unreadCount, labels, markingAllRead, onMarkAllRead }: NotificationInboxProps) {
  if (!onMarkAllRead) return null;
  const disabled = unreadCount === null || unreadCount === 0 || Boolean(markingAllRead);
  return (
    <button
      type="button"
      className="notification-inbox-button"
      aria-disabled={disabled || undefined}
      aria-busy={markingAllRead || undefined}
      onClick={() => { if (!disabled) onMarkAllRead(); }}
    >{labels.markAllRead}</button>
  );
}

type FeedProps = NotificationInboxProps & { heading: "h2" | "h3"; onNavigate?: () => void };

function InboxFeed({ items, status = "ready", mutationError, onRetry, ...entryProps }: FeedProps) {
  const { labels } = entryProps;
  const message = status === "loading" ? labels.loading : status === "error" ? labels.error : items.length === 0 ? labels.empty : null;
  return (
    <div className="notification-inbox-feed">
      {mutationError && <div className="notification-inbox-message"><p role="alert">{mutationError}</p></div>}
      {message && (
        <div className="notification-inbox-message">
          <p role="status">{message}</p>
          {status === "error" && onRetry && (
            <button type="button" className="notification-inbox-button" onClick={onRetry}>{labels.retry}</button>
          )}
        </div>
      )}
      {items.length > 0 && (
        <ul className="notification-inbox-list" role="list">
          {items.map((item) => <InboxEntry key={item.id} {...entryProps} item={item} />)}
        </ul>
      )}
    </div>
  );
}

type EntryProps = Pick<FeedProps, "heading" | "icon" | "labels" | "markingAllRead" | "onMarkRead" | "onNavigate"> & { item: NotificationInboxItem };

function InboxEntry({ item, heading: Heading, icon, labels, markingAllRead, onMarkRead, onNavigate }: EntryProps) {
  const headingId = useId();
  const { action, timestamp } = item;
  const knownTime = timestamp && timestamp.label.trim() && Number.isFinite(Date.parse(timestamp.dateTime)) ? timestamp : null;
  return (
    <li className="notification-inbox-entry" data-unread={!item.read}>
      <span className="notification-inbox-icon" aria-hidden="true">{item.icon ?? icon}</span>
      <div>
        <Heading id={headingId}>{item.title}</Heading>
        <p className="notification-inbox-body">{item.body}</p>
        <div className="notification-inbox-meta">
          <span className="notification-inbox-read-state">{item.read ? labels.read : labels.unread}</span>
          {knownTime && <time dateTime={knownTime.dateTime}>{knownTime.label}</time>}
        </div>
        {(action || onMarkRead) && (
          <div className="notification-inbox-actions">
            {action && (
              <button type="button" className="notification-inbox-button" onClick={() => {
                onNavigate?.();
                action.onSelect(item.id);
              }}>{action.label}</button>
            )}
            {onMarkRead && (
              <button
                type="button"
                className="notification-inbox-button notification-inbox-mark"
                aria-describedby={headingId}
                aria-disabled={item.read || item.markingRead || markingAllRead || undefined}
                aria-busy={item.markingRead || undefined}
                tabIndex={item.read ? -1 : undefined}
                onClick={() => {
                  if (!item.read && !item.markingRead && !markingAllRead) onMarkRead(item.id);
                }}
              >{labels.markRead}</button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
