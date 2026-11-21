import { defaultRoomLayout, layoutAspectGroup, magicTokenFromSearch, parseRoomCode, parseStoredLayouts, ROOM_LAYOUT_STORAGE_KEY, serializeStoredLayouts, storeLayoutForAspect, type RoomLayout } from "@lume/contracts";
import { useEffect, useMemo, useState } from "react";
import { api, apiUrl } from "./api/client.js";
import { detectLocale, I18nProvider } from "./i18n/context.js";
import { ToastProvider } from "./ui/Toast.js";
import { useRoomChannel } from "./realtime/useRoomChannel.js";
import { DesignApp } from "./design/DesignApp.js";
import { AdminScreen } from "./screens/AdminScreen.js";
import { copy } from "./design/copy.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { clearSession, loadSession, saveSession, type ClientSession } from "./session.js";
import { bindBackButton, hapticImpact, themeParamsToCssVars } from "./telegram/adapter.js";
import { readTelegramWebApp } from "./telegram/types.js";

const PENDING_JOIN_KEY = "lume-pending-room";
const INVITE_PATH_PREFIX = "/join/";

function inviteCodeFromPath(path: string): string | null {
  try {
    return parseRoomCode(decodeURIComponent(path.slice(INVITE_PATH_PREFIX.length)));
  } catch {
    return null;
  }
}

function initialPendingJoin(start: string | undefined): string | null {
  const path = window.location.pathname;
  if (path.startsWith(INVITE_PATH_PREFIX)) return inviteCodeFromPath(path) ?? "invalid";
  // The bot can supply a navigation hint in the URL; it is not Telegram auth data.
  const source = start ?? new URLSearchParams(window.location.search).get("tgWebAppStartParam");
  if (source?.startsWith("room_")) return parseRoomCode(source.slice("room_".length)) ?? "invalid";
  const stored = window.sessionStorage.getItem(PENDING_JOIN_KEY);
  return stored === null ? null : parseRoomCode(stored) ?? "invalid";
}

function navigate(path: string, replace = false): void {
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
  const webApp = useMemo(() => readTelegramWebApp(), []);
  const inTelegram = webApp !== null;
  const [locale] = useState(() =>
    webApp ? detectLocale(webApp.initDataUnsafe?.user?.language_code) : "ru",
  );
  const [session, setSession] = useState<ClientSession | null>(() => loadSession());
  const [roomId, setRoomId] = useState<string | null>(null);
  const [adminPath, setAdminPath] = useState(() => window.location.pathname.startsWith("/admin"));
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(() => initialPendingJoin(webApp?.initDataUnsafe?.start_param));
  const [layout, setLayout] = useState<RoomLayout>(() => {
    const stored = parseStoredLayouts(window.localStorage.getItem(ROOM_LAYOUT_STORAGE_KEY));
    return stored[layoutAspectGroup(defaultRoomLayout.videoAspect)];
  });
  const live = useRoomChannel(
    session && roomId ? { token: session.accessToken, roomId, selfId: session.user.id } : null,
  );

  useEffect(() => {
    if (!webApp) return;
    document.documentElement.dataset.telegram = "true";
    const applyTheme = () => {
      const vars = themeParamsToCssVars(webApp.themeParams ?? {});
      for (const [name, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(name, value);
      }
    };
    applyTheme();
    webApp.onEvent?.("themeChanged", applyTheme);
    return () => {
      webApp.offEvent?.("themeChanged", applyTheme);
      delete document.documentElement.dataset.telegram;
    };
  }, [webApp]);

  useEffect(() => {
    document.documentElement.lang = locale;
    webApp?.ready?.();
    webApp?.expand?.();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const magic = magicTokenFromSearch(window.location.search);
    if (magic) {
      void api.verifyMagic(magic).then((result) => {
        const next = { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user };
        saveSession(next);
        setSession(next);
        const url = new URL(window.location.href);
        url.searchParams.delete("magic");
        window.history.replaceState({}, "", url.pathname + url.search);
      }).catch(() => undefined);
    }
  }, [locale, webApp]);

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      setAdminPath(path.startsWith("/admin"));
      if (path.startsWith(INVITE_PATH_PREFIX)) setPendingJoin(inviteCodeFromPath(path) ?? "invalid");
      else if (path !== "/auth") {
        window.sessionStorage.removeItem(PENDING_JOIN_KEY);
        setPendingJoin(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!adminPath || !session) {
      setIsAdmin(false);
      return;
    }
    let stopped = false;
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { role?: string } | null) => {
        if (!stopped) setIsAdmin(payload?.role === "ADMIN" || payload?.role === "SUPERADMIN");
      })
      .catch(() => {
        if (!stopped) setIsAdmin(false);
      });
    return () => {
      stopped = true;
    };
  }, [adminPath, session]);

  useEffect(() => {
    if (!pendingJoin) return;
    if (pendingJoin === "invalid") {
      navigate("/missing", true);
      return;
    }
    window.sessionStorage.setItem(PENDING_JOIN_KEY, pendingJoin);
    if (!session) {
      if (window.location.pathname !== "/auth") navigate(`/auth${window.location.search}`, true);
      return;
    }
    let stopped = false;
    // Let a synchronous effect cleanup cancel the request before it spends join quota.
    queueMicrotask(async () => {
      if (stopped) return;
      try {
        const result = await api.joinRoom(session.accessToken, pendingJoin);
        if (stopped) return;
        setRoomId(result.room.id);
        navigate("/", true);
      } catch {
        if (!stopped) navigate("/missing", true);
      }
    });
    return () => {
      stopped = true;
    };
  }, [session, pendingJoin]);

  useEffect(() => {
    const button = webApp?.MainButton;
    if (!button) return;
    if (roomId || (session && pendingJoin)) {
      button.hide();
      return;
    }
    button.setText(pendingJoin ? copy(locale).openRoom : copy(locale).create);
    button.show();
    const open = () => {
      if (pendingJoin) {
        if (window.location.pathname !== "/auth") navigate("/auth");
      }
      else navigate("/create");
    };
    button.onClick(open);
    return () => button.offClick(open);
  }, [roomId, session, pendingJoin, webApp, locale]);

  useEffect(() => {
    if (!inTelegram || !roomId) return;
    return bindBackButton(webApp, () => setRoomId(null));
  }, [inTelegram, roomId, webApp]);

  useEffect(() => {
    if (live.error === "kicked") setRoomId(null);
  }, [live.error]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ROOM_LAYOUT_STORAGE_KEY) return;
      setLayout((current) => parseStoredLayouts(event.newValue)[layoutAspectGroup(current.videoAspect)]);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function updateLayout(next: RoomLayout) {
    const group = layoutAspectGroup(next.videoAspect);
    const stored = parseStoredLayouts(window.localStorage.getItem(ROOM_LAYOUT_STORAGE_KEY));
    const resolved = group === layoutAspectGroup(layout.videoAspect)
      ? next
      : { ...stored[group], videoAspect: next.videoAspect };
    const updated = storeLayoutForAspect(stored, resolved);
    window.localStorage.setItem(ROOM_LAYOUT_STORAGE_KEY, serializeStoredLayouts(updated));
    setLayout(resolved);
    if (roomId && session) {
      void fetch(`${apiUrl}/rooms/${roomId}/layout`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify(resolved),
      }).catch(() => undefined);
    }
  }

  function pulse(style: "light" | "medium") {
    hapticImpact(inTelegram ? webApp : null, style);
  }

  return (
    <I18nProvider locale={locale}>
      <ToastProvider>
      <div className="app-root">
        {adminPath && session && isAdmin ? (
          <AdminScreen token={session.accessToken} />
        ) : (
          <DesignApp
            session={session}
            onSession={(next) => {
              saveSession(next);
              setSession(next);
              pulse("light");
            }}
            onSignOut={() => {
              if (session?.refreshToken) void api.logout(session.refreshToken).catch(() => undefined);
              clearSession();
              setSession(null);
              setRoomId(null);
            }}
            roomId={roomId}
            joiningInvite={Boolean(session && pendingJoin && pendingJoin !== "invalid")}
            onJoinNeedsAuth={(code) => {
              setPendingJoin(code);
              navigate("/auth");
            }}
            onOpen={(id) => {
              setRoomId(id);
              pulse("medium");
            }}
            onLeave={() => {
              if (session && roomId) void api.leave(session.accessToken, roomId).catch(() => undefined);
              setRoomId(null);
            }}
            room={
              session && roomId ? (
                <RoomScreen
                  selfId={session.user.id}
                  live={live}
                  layout={layout}
                  onLayout={updateLayout}
                  onLeave={() => {
                    void api.leave(session.accessToken, roomId).catch(() => undefined);
                    setRoomId(null);
                  }}
                />
              ) : null
            }
          />
        )}
      </div>
      </ToastProvider>
    </I18nProvider>
  );
}
