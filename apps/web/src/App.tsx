import { defaultRoomLayout, type RoomLayout } from "@lume/contracts";
import { themeById } from "@lume/ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { detectLocale, I18nProvider, useI18n } from "./i18n/context.js";
import { connectRealtime } from "./realtime/client.js";
import { Lobby } from "./screens/Lobby.js";
import { RoomScreen } from "./screens/RoomScreen.js";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import {
  bindBackButton,
  hapticImpact,
  previewThemeParams,
  themeParamsToCssVars,
} from "./telegram/adapter.js";
import { readTelegramWebApp } from "./telegram/types.js";

type RealtimeStatus = "off" | "connecting" | "online" | "error";

function useRealtimeStatus(url: string | undefined): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(url ? "connecting" : "off");

  useEffect(() => {
    if (!url) {
      setStatus("off");
      return;
    }
    let stopped = false;
    let socket: { close: () => void } | undefined;
    setStatus("connecting");
    void connectRealtime(url)
      .then((client) => {
        if (stopped) {
          client.close();
          return;
        }
        socket = client;
        client.on("connect", () => setStatus("online"));
        client.on("connect_error", () => setStatus("error"));
        client.on("disconnect", () => setStatus("error"));
      })
      .catch(() => {
        if (!stopped) {
          setStatus("error");
        }
      });
    return () => {
      stopped = true;
      socket?.close();
    };
  }, [url]);

  return status;
}

export function App() {
  const webApp = useMemo(() => readTelegramWebApp(), []);
  const inTelegram = webApp !== null;
  const [locale, setLocale] = useState(() =>
    webApp ? detectLocale(webApp.initDataUnsafe?.user?.language_code) : "ru",
  );
  const [themeId, setThemeId] = useState("ember");
  const [preview, setPreview] = useState(false);
  const [screen, setScreen] = useState<"lobby" | "room">("lobby");
  const [title, setTitle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [layout, setLayout] = useState<RoomLayout>(defaultRoomLayout);
  const [haptic, setHaptic] = useState<string | null>(null);
  const realtime = useRealtimeStatus(import.meta.env.VITE_REALTIME_URL);
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
  }, [locale, webApp]);

  useEffect(() => {
    if (!inTelegram || screen !== "room") {
      return;
    }
    return bindBackButton(webApp, () => setScreen("lobby"));
  }, [inTelegram, screen, webApp]);

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
          onBack={() => setScreen("lobby")}
          screen={screen}
        >
          {screen === "lobby" ? (
            <Lobby
              onEnter={(input) => {
                setTitle(input.title);
                setDisplayName(input.displayName);
                setScreen("room");
                pulse("medium");
              }}
            />
          ) : (
            <RoomScreen
              title={title}
              displayName={displayName}
              layout={layout}
              onLayout={setLayout}
              onLeave={() => setScreen("lobby")}
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
  realtime: RealtimeStatus;
  inTelegram: boolean;
  preview: boolean;
  haptic: string | null;
  screen: "lobby" | "room";
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
