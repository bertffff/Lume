import { Bell } from "lucide-react";
import { useI18n } from "../i18n/context.js";
import type { NotificationInboxProps } from "../screens/notifications/NotificationInbox.js";
import { copy } from "./copy.js";
import { useNotificationFeed } from "./useNotificationFeed.js";

/** The notification feed shaped for the inbox popover and page, plus the reminder subset the home screen shows. */
export function useInbox(token: string | undefined, go: (path: string) => void) {
  const { locale, t } = useI18n();
  const text = copy(locale);
  const notifications = useNotificationFeed(token);
  const notes = notifications.feed?.notifications ?? [];
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const inbox: NotificationInboxProps = {
    unreadCount: notifications.feed?.unread ?? null,
    status: notifications.phase,
    markingAllRead: notifications.marking === null,
    mutationError: notifications.failedMutation ? t("inbox.markError") : null,
    icon: <Bell aria-hidden="true" size={18} />,
    items: notes.map((row) => {
      const date = new Date(row.createdAt);
      return {
        ...row,
        markingRead: notifications.marking === row.id,
        timestamp: Number.isFinite(date.getTime()) ? { dateTime: row.createdAt, label: formatter.format(date) } : null,
        ...(row.target === "/profile" ? { action: { label: t("inbox.openProfile"), onSelect: () => go("/profile") } } : {}),
      };
    }),
    labels: {
      title: text.notifications, unreadCount: (count) => t("inbox.count", { count }), read: t("inbox.read"),
      unread: t("inbox.unread"), markRead: t("inbox.mark"), markAllRead: t("inbox.markAll"), empty: t("inbox.empty"),
      loading: t("inbox.loading"), error: t("inbox.error"), retry: t("common.retry"),
    },
    onMarkRead: (id) => void notifications.mark(id),
    onMarkAllRead: () => void notifications.mark(null),
    onRetry: () => void notifications.reload(),
  };
  return { inbox, reminders: notes.filter((note) => note.kind === "SYSTEM") };
}
