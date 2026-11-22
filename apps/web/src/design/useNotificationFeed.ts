import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

type Feed = Awaited<ReturnType<typeof api.notifications>>;
type InboxState = { token: string; feed?: Feed; phase: "loading" | "ready" | "error" };

export function useNotificationFeed(token: string | undefined) {
  const [state, setState] = useState<InboxState>();
  const [pending, setPending] = useState<{ token: string; id: string | null }>();
  const [errorToken, setErrorToken] = useState<string>();
  const active = useRef({ request: 0, mutation: false });

  const reload = useCallback(async () => {
    if (!token || active.current.mutation) return;
    const request = ++active.current.request;
    setState((previous) => ({ token, feed: previous?.token === token ? previous.feed : undefined, phase: "loading" }));
    try {
      const feed = await api.notifications(token);
      if (request === active.current.request) setState({ token, feed, phase: "ready" });
    } catch {
      if (request === active.current.request) setState((previous) => ({ token, feed: previous?.feed, phase: "error" }));
    }
  }, [token]);

  useEffect(() => {
    void reload();
    return () => { active.current = { request: active.current.request + 1, mutation: false }; };
  }, [reload]);

  async function mark(id: string | null) {
    if (!token || active.current.mutation) return;
    const scope = active.current;
    scope.request++;
    scope.mutation = true;
    setPending({ token, id });
    setErrorToken(undefined);
    try {
      const { unread } = id === null ? await api.markAllNotificationsRead(token) : await api.markNotificationRead(token, id);
      if (scope !== active.current) return;
      setState((previous) => ({ token, phase: "ready", feed: {
        unread,
        notifications: (previous?.token === token ? previous.feed?.notifications ?? [] : []).map((item) =>
          id === null || item.id === id ? { ...item, read: true } : item),
      } }));
    } catch {
      if (scope === active.current) setErrorToken(token);
    } finally {
      if (scope === active.current) {
        scope.mutation = false;
        setPending(undefined);
        void reload();
      }
    }
  }

  return {
    feed: state?.token === token ? state?.feed : undefined,
    phase: state?.token === token ? state?.phase ?? "ready" : token ? "loading" : "ready",
    marking: pending?.token === token ? pending?.id : undefined,
    failedMutation: Boolean(token && errorToken === token),
    reload,
    mark,
  } as const;
}
