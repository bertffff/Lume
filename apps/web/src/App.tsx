import { defaultRoomLayout, type RoomLayout } from "@lume/contracts";
import { themeById } from "@lume/ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api/client.js";
import { detectLocale, I18nProvider, useI18n } from "./i18n/context.js";
import { useRoomChannel, type ChannelStatus } from "./realtime/useRoomChannel.js";
import { DesignApp } from "./design/DesignApp.js";
import { AdminScreen } from "./screens/AdminScreen.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { clearSession, loadSession, saveSession, type ClientSession } from "./session.js";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import {
  bindBackButton,
  hapticImpact,
  previewThemeParams,
  themeParamsToCssVars,
} from "./telegram/adapter.js";
import { readTelegramWebApp } from "./telegram/types.js";

export function App() {
  const webApp = useMemo(() => readTelegramWebApp(), []);
  const inTelegram = webApp !== null;
  const [locale, setLocale] = useState(() =>
    webApp ? detectLocale(webApp.initDataUnsafe?.user?.language_code) : "ru",
  );
  const [themeId, setThemeId] = useState("ember");
  const [preview, setPreview] = useState(false);
  const [session, setSession] = useState<ClientSession | null>(() => loadSession());
  const [roomId, setRoomId] = useState<string | null>(null);
  const [adminPath, setAdminPath] = useState(() => window.location.pathname.startsWith("/admin"));
  const [layout, setLayout] = useState<RoomLayout>(defaultRoomLayout);
  const [haptic, setHaptic] = useState<string | null>(null);
  const live = useRoomChannel(
    session && roomId ? { token: session.accessToken, roomId, selfId: session.user.id } : null,
  );
  const screen = roomId ? "room" : adminPath ? "admin" : "lobby";
  const realtime: ChannelStatus = roomId ? live.status : "off";
  const theme = themeById(themeId);
  const overrides = useMemo(() => {
    if (inTelegram && webApp.themeParams) {
      return themeParamsToCssVars(webApp.themeParams);
    }
    if (preview) {
      return themeParamsToCssVars(previewThemeParams);
    }
    return {};
  }, [inTelegram, preview, webApp]);

  useEffect(() => {
    document.documentElement.lang = locale;
    webApp?.ready?.();
    webApp?.expand?.();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const start = webApp?.initDataUnsafe?.start_param;
    if (start?.startsWith("room_")) {
      sessionStorage.setItem("lume-pending-room", start.slice("room_".length));
    }
    if (start?.startsWith("user_")) {
      sessionStorage.setItem("lume-pending-user", start.slice("user_".length));
    }
    const button = webApp?.MainButton;
    if (button && !roomId) {
      button.setText("Создать комнату");
      button.show();
      const open = () => setRoomId(sessionStorage.getItem("lume-pending-room"));
      button.onClick(open);
      return () => button.offClick(open);
    }
    button?.hide();
    return undefined;
  }, [locale, roomId, webApp]);

  useEffect(() => {
    if (!inTelegram || screen !== "room") {
      return;
    }
    return bindBackButton(webApp, () => setRoomId(null));
  }, [inTelegram, screen, webApp]);

  useEffect(() => {
    if (window.location.pathname.startsWith("/join/")) {
      const code = window.location.pathname.split("/")[2] ?? "";
      if (code) sessionStorage.setItem("lume-pending-room", decodeURIComponent(code));
    }
    const onPop = () => setAdminPath(window.location.pathname.startsWith("/admin"));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (live.error === "kicked") {
      setRoomId(null);
    }
  }, [live.error]);

  function pulse(style: "light" | "medium") {
    const delivered = hapticImpact(inTelegram ? webApp : null, style);
    if (!delivered && preview) {
      setHaptic(style);
      window.setTimeout(() => setHaptic(null), 1800);
    }
  }

  return (
    <I18nProvider locale={locale}>
      <ThemeProvider theme={theme} overrides={overrides}>
        <Shell
          locale={locale}
          themeId={themeId}
          realtime={realtime}
          inTelegram={inTelegram}
          preview={preview}
          haptic={haptic}
          onLocale={() => {
            setLocale((value) => (value === "ru" ? "en" : "ru"));
            pulse("light");
          }}
          onTheme={(id) => {
            setThemeId(id);
            pulse("medium");
          }}
          onPreview={() => setPreview((value) => !value)}
          onBack={() => setRoomId(null)}
          screen={screen}
        >
          {adminPath && session ? (
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
                    onLayout={setLayout}
                    onLeave={() => {
                      void api.leave(session.accessToken, roomId).catch(() => undefined);
                      setRoomId(null);
                    }}
                  />
                ) : null
              }
            />
          )}
        </Shell>
      </ThemeProvider>
    </I18nProvider>
  );
}

function Shell({
  locale,
  themeId,
  realtime,
  inTelegram,
  preview,
  haptic,
  screen,
  onLocale,
  onTheme,
  onPreview,
  onBack,
  children,
}: {
  locale: "ru" | "en";
  themeId: string;
  realtime: ChannelStatus;
  inTelegram: boolean;
  preview: boolean;
  haptic: string | null;
  screen: "lobby" | "room" | "admin";
  onLocale: () => void;
  onTheme: (id: string) => void;
  onPreview: () => void;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const realtimeLabel = {
    off: t("realtime.off"),
    connecting: t("realtime.connecting"),
    online: t("realtime.online"),
    error: t("realtime.error"),
  }[realtime];

  return (
    <div className="tr-app">
      <header className="tr-header bg-surface text-ink">
        <div className="tr-brand">
          <span className="font-display text-2xl">{t("app.name")}</span>
          <span className="text-muted">{t("app.tagline")}</span>
        </div>
        <div className="tr-header-actions">
          <span className={`tr-chip tr-realtime is-${realtime}`}>
            {t("nav.realtime")} · {realtimeLabel}
          </span>
          {inTelegram ? <span className="tr-chip">{t("tg.badge")}</span> : null}
          <button type="button" className="tr-text-button" onClick={onLocale} aria-label={t("nav.language")}>
            {locale === "ru" ? "EN" : "RU"}
          </button>
          <button
            type="button"
            className={themeId === "ember" ? "tr-text-button is-on" : "tr-text-button"}
            onClick={() => onTheme("ember")}
          >
            {t("theme.ember")}
          </button>
          <button
            type="button"
            className={themeId === "aurora" ? "tr-text-button is-on" : "tr-text-button"}
            onClick={() => onTheme("aurora")}
          >
            {t("theme.aurora")}
            <em>{t("theme.premium")}</em>
          </button>
          {inTelegram ? null : (
            <button type="button" className="tr-text-button" onClick={onPreview}>
              {preview ? t("tg.previewOff") : t("tg.previewOn")}
            </button>
          )}
        </div>
      </header>
      {preview && screen === "room" ? (
        <button type="button" className="tr-back" onClick={onBack}>
          {t("tg.back")}
        </button>
      ) : null}
      <main className="tr-main">{children}</main>
      {haptic ? (
        <div className="tr-toast" role="status">
          {t("tg.haptic")} · {haptic}
        </div>
      ) : null}
    </div>
  );
}
