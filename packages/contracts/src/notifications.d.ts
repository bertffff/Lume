/** Allowlisted internal routes; never a URL taken from a notification payload. */
export type NotificationTarget = "/profile";

export type NotificationListEntry = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  target: NotificationTarget | null;
};

export type NotificationReadAllResponse = { unread: number };
export type NotificationReadResponse = NotificationReadAllResponse & { ok: true };

export type NotificationListResponse = NotificationReadAllResponse & {
  notifications: NotificationListEntry[];
};
