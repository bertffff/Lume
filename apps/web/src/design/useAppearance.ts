import { useEffect, useState } from "react";
import { apiUrl } from "../api/client.js";
import { applyAppearance, readStoredMode, readStoredStyle, type ModeId, type StyleId } from "./theme.js";

/** Appearance state: URL override, persistence, system-mode listener, profile sync. */
export function useAppearance(session: { accessToken: string } | null) {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("style");
  const [style, setStyle] = useState<StyleId>(requested === "gruvbox" || requested === "cinema" ? requested : readStoredStyle);
  const [mode, setMode] = useState<ModeId>(
    params.get("mode") === "light" || params.get("mode") === "system" || params.get("mode") === "dark"
      ? (params.get("mode") as ModeId)
      : readStoredMode,
  );

  useEffect(() => {
    applyAppearance(style, mode);
  }, [style, mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyAppearance(style, "system", media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [style, mode]);

  async function saveAppearance(nextStyle: StyleId, nextMode: ModeId) {
    setStyle(nextStyle);
    setMode(nextMode);
    applyAppearance(nextStyle, nextMode);
    if (!session) return;
    await fetch(`${apiUrl}/me`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ uiStyle: nextStyle, uiMode: nextMode }),
    }).catch(() => undefined);
  }

  return { style, mode, setStyle, setMode, saveAppearance };
}
