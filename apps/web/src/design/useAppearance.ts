import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";
import { readTelegramWebApp } from "../telegram/types.js";
import {
  applyAppearance, isStyleId, isThemeMode, readStoredMode, readStoredStyle, type ThemeMode, type StyleId,
} from "./theme.js";

type Appearance = { style: StyleId; mode: ThemeMode };
type AppearanceUpdate = Partial<Appearance>;

function readPreview() {
  const params = new URLSearchParams(window.location.search);
  const style = params.get("style");
  const mode = params.get("mode");
  return {
    shot: params.has("shot"),
    override: { style: isStyleId(style) ? style : undefined, mode: isThemeMode(mode) ? mode : undefined },
  };
}

function useAppliedAppearance(style: StyleId, mode: ThemeMode) {
  useEffect(() => {
    if (mode !== "system") {
      applyAppearance(style, mode);
      return;
    }

    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    if (media && media.media !== "not all") {
      const update = () => applyAppearance(style, mode, media.matches);
      update();
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
      }
      media.addListener?.(update);
      return () => media.removeListener?.(update);
    }

    const telegram = readTelegramWebApp();
    const update = () => applyAppearance(style, mode, telegram?.colorScheme === "light");
    update();
    if (!telegram?.onEvent || !telegram.offEvent) return;
    telegram.onEvent("themeChanged", update);
    return () => telegram.offEvent?.("themeChanged", update);
  }, [mode, style]);
}

/** One instance at the shell. Profile setters hydrate; action callbacks alone write. */
export function useAppearance(session: { accessToken: string } | null) {
  const [preview] = useState(readPreview);
  const [override, setOverride] = useState<AppearanceUpdate>(preview.override);
  const [preferences, setPreferences] = useState<Appearance>(() => ({
    style: readStoredStyle(), mode: readStoredMode(),
  }));
  const style = override.style ?? preferences.style;
  const mode = override.mode ?? preferences.mode;
  useAppliedAppearance(style, mode);

  const setStyle = useCallback((next: StyleId) => {
    setPreferences((current) => ({ ...current, style: next }));
  }, []);
  const setMode = useCallback((next: ThemeMode) => {
    setPreferences((current) => ({ ...current, mode: next }));
  }, []);

  async function save(update: AppearanceUpdate) {
    if (!update.style && !update.mode) return;
    if (preview.shot) {
      setOverride((current) => ({ ...current, ...update }));
      return;
    }

    setPreferences((current) => ({ ...current, ...update }));
    setOverride((current) => ({
      style: update.style ? undefined : current.style,
      mode: update.mode ? undefined : current.mode,
    }));
    if (update.style) window.localStorage.setItem("lume.style", update.style);
    if (update.mode) window.localStorage.setItem("lume.mode", update.mode);
    if (!session) return;

    await fetch(`${apiUrl}/me`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ uiStyle: update.style, uiMode: update.mode }),
    }).catch(() => undefined);
  }

  return {
    style, mode, setStyle, setMode,
    saveStyle: (next: StyleId) => save({ style: next }),
    saveMode: (next: ThemeMode) => save({ mode: next }),
    // Existing shell callers supply the currently displayed value on the untouched axis.
    saveAppearance: (nextStyle: StyleId, nextMode: ThemeMode) => save({
      ...(nextStyle !== style ? { style: nextStyle } : {}),
      ...(nextMode !== mode ? { mode: nextMode } : {}),
    }),
  };
}
