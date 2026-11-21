import { defaultRoomLayout, layoutAspectGroup, magicTokenFromSearch, parseStoredLayouts, ROOM_LAYOUT_STORAGE_KEY, serializeStoredLayouts, storeLayoutForAspect, type RoomLayout } from "@lume/contracts";
import { useEffect, useMemo, useState } from "react";
import { api, apiUrl } from "./api/client.js";
import { detectLocale, I18nProvider } from "./i18n/context.js";
import { ToastProvider } from "./ui/Toast.js";
import { useRoomChannel } from "./realtime/useRoomChannel.js";
import { DesignApp } from "./design/DesignApp.js";
import { AdminScreen } from "./screens/AdminScreen.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { clearSession, loadSession, saveSession, type ClientSession } from "./session.js";
import { bindBackButton, hapticImpact } from "./telegram/adapter.js";
import { readTelegramWebApp } from "./telegram/types.js";

const PENDING_JOIN_KEY = "lume-pending-room";

/** `/join/:code` links and Telegram `room_<code>` start params both carry a room code. */
function pendingJoinCode(): string | null {
  if (window.location.pathname.startsWith("/join/")) {
    const code = window.location.pathname.split("/")[2] ?? "";
    if (code) return decodeURIComponent(code);
  }
  return sessionStorage.getItem(PENDING_JOIN_KEY);
}

function navigate(path: string): void {
  window.history.pushState({}, "", path);
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
  const [pendingJoin, setPendingJoin] = useState<string | null>(() => pendingJoinCode());
  const [layout, setLayout] = useState<RoomLayout>(() => {
    const stored = parseStoredLayouts(window.localStorage.getItem(ROOM_LAYOUT_STORAGE_KEY));
    return stored[layoutAspectGroup(defaultRoomLayout.videoAspect)];
  });
  const live = useRoomChannel(
    session && roomId ? { token: session.accessToken, roomId, selfId: session.user.id } : null,
  );

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
    const start = webApp?.initDataUnsafe?.start_param;
    if (start?.startsWith("room_")) {
      const code = start.slice("room_".length);
      sessionStorage.setItem(PENDING_JOIN_KEY, code);
      setPendingJoin(code);
    }
  }, [locale, webApp]);

  useEffect(() => {
    const onPop = () => setAdminPath(window.location.pathname.startsWith("/admin"));
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
    if (!session || !pendingJoin) return;
    let stopped = false;
    void api.joinRoom(session.accessToken, pendingJoin)
      .then((result) => {
        if (stopped) return;
        setRoomId(result.room.id);
        setPendingJoin(null);
        sessionStorage.removeItem(PENDING_JOIN_KEY);
        if (window.location.pathname.startsWith("/join/")) navigate("/");
      })
      .catch(() => {
        if (!stopped) {
          setPendingJoin(null);
          sessionStorage.removeItem(PENDING_JOIN_KEY);
        }
      });
    return () => {
      stopped = true;
    };
  }, [session, pendingJoin]);

  useEffect(() => {
    const button = webApp?.MainButton;
    if (!button) return;
    if (roomId) {
      button.hide();
      return;
    }
    button.setText(pendingJoin ? "Открыть комнату" : "Создать комнату");
    button.show();
    const open = () => {
      const code = sessionStorage.getItem(PENDING_JOIN_KEY);
      if (code) setPendingJoin(code);
      else navigate("/create");
    };
    button.onClick(open);
    return () => button.offClick(open);
  }, [roomId, pendingJoin, webApp]);

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
