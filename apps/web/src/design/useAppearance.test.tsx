import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentStyle } from "./theme.js";
import { useAppearance } from "./useAppearance.js";

const media = new EventTarget();
let prefersLight = false;

function changeSystemMode(light: boolean) {
  prefersLight = light;
  act(() => { media.dispatchEvent(new Event("change")); });
}

beforeEach(() => {
  window.localStorage.clear();
  prefersLight = false;
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return prefersLight; },
    addEventListener: media.addEventListener.bind(media),
    removeEventListener: media.removeEventListener.bind(media),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  delete document.documentElement.dataset.style;
  delete document.documentElement.dataset.mode;
  delete document.documentElement.dataset.theme;
});

describe("appearance preferences", () => {
  it("keeps mode when style changes and restores TeleRave on remount", async () => {
    window.localStorage.setItem("lume.mode", "light");
    const { result, unmount } = renderHook(() => useAppearance(null));
    await act(() => result.current.saveStyle("telerave"));
    expect(result.current.mode).toBe("light");
    expect(currentStyle()).toBe("telerave");
    expect(document.documentElement.dataset.theme).toBe("light");
    unmount();
    const restored = renderHook(() => useAppearance(null));
    expect(restored.result.current).toMatchObject({ style: "telerave", mode: "light" });
  });

  it("reacts to the OS only in system mode and does not persist the resolved palette", async () => {
    const { result } = renderHook(() => useAppearance(null));
    changeSystemMode(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    await act(() => result.current.saveMode("system"));
    expect(document.documentElement.dataset.theme).toBe("light");
    changeSystemMode(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("lume.mode")).toBe("system");
    await act(() => result.current.saveMode("light"));
    changeSystemMode(false);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("falls back to Telegram colour scheme if matchMedia is unavailable", async () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.stubGlobal("Telegram", { WebApp: { colorScheme: "light" } });
    const { result } = renderHook(() => useAppearance(null));
    await act(() => result.current.saveMode("system"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("keeps shot appearance and its controls isolated from both stores", async () => {
    window.history.replaceState(null, "", "/?shot=home&style=telerave&mode=system");
    window.localStorage.setItem("lume.style", "cinema");
    window.localStorage.setItem("lume.mode", "light");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAppearance({ accessToken: "test-token" }));
    expect(result.current).toMatchObject({ style: "telerave", mode: "system" });
    changeSystemMode(false);
    await act(() => result.current.saveStyle("gruvbox"));
    expect(currentStyle()).toBe("gruvbox");
    expect(window.localStorage.getItem("lume.style")).toBe("cinema");
    expect(window.localStorage.getItem("lume.mode")).toBe("light");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not save a URL-only override on the other axis", async () => {
    window.history.replaceState(null, "", "/?style=telerave");
    window.localStorage.setItem("lume.style", "cinema");
    const fetch = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useAppearance({ accessToken: "test-token" }));
    expect(result.current.style).toBe("telerave");
    await act(() => result.current.saveAppearance(result.current.style, "light"));
    expect(window.localStorage.getItem("lume.style")).toBe("cinema");
    expect(window.localStorage.getItem("lume.mode")).toBe("light");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/me$/), expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ uiMode: "light" }),
    }));
  });
});
