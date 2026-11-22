import { linkedLabel } from "@lume/contracts";
import { useCallback, useEffect, useState } from "react";

interface Prefs { friendsPublic: boolean; historyPublic: boolean; hideOther: boolean }

/** Account facts shown on the settings page, plus optimistic writes that roll back when the request fails. */
export function useSettingsData(token: string | undefined, apiUrl: string | undefined, fallbackLinked: string, noLinked: string) {
  const [services, setServices] = useState<string[]>([]);
  const [linked, setLinked] = useState(fallbackLinked);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ friendsPublic: true, historyPublic: true, hideOther: false });

  useEffect(() => {
    if (!apiUrl) return;
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;
    void fetch(`${apiUrl}/video/services`).then((response) => response.json()).then((payload: { services?: string[] }) => setServices(payload.services ?? [])).catch(() => setServices([]));
    if (!headers) return;
    void fetch(`${apiUrl}/auth/linked-accounts`, { headers }).then((response) => response.json()).then((payload: { email?: boolean; telegram?: boolean }) => {
      setLinked(linkedLabel({ email: Boolean(payload.email), telegram: Boolean(payload.telegram) }));
      setTelegramLinked(Boolean(payload.telegram));
    }).catch(() => setLinked(noLinked));
    void fetch(`${apiUrl}/me`, { headers }).then((response) => response.json()).then((payload: { isFriendsPublic?: boolean; isWatchHistoryPublic?: boolean; hideOtherReactions?: boolean }) => {
      setPrefs((current) => ({
        friendsPublic: typeof payload.isFriendsPublic === "boolean" ? payload.isFriendsPublic : current.friendsPublic,
        historyPublic: typeof payload.isWatchHistoryPublic === "boolean" ? payload.isWatchHistoryPublic : current.historyPublic,
        hideOther: typeof payload.hideOtherReactions === "boolean" ? payload.hideOtherReactions : current.hideOther,
      }));
    }).catch(() => undefined);
  }, [token, apiUrl, noLinked]);

  const send = useCallback((path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) => {
    if (!token || !apiUrl) return Promise.reject(new Error("unauthenticated"));
    return fetch(`${apiUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }).then((response) => { if (!response.ok) throw new Error(String(response.status)); return response; });
  }, [token, apiUrl]);

  const setPref = useCallback((key: keyof Prefs, field: string, next: boolean) => {
    setPrefs((current) => ({ ...current, [key]: next }));
    void send("/me", "PATCH", { [field]: next }).catch(() => setPrefs((current) => ({ ...current, [key]: !next })));
  }, [send]);

  return { services, linked, telegramLinked, prefs, setPref, send };
}
