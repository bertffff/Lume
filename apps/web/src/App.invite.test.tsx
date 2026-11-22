import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ClientError } from "./api/client.js";
import { App } from "./App.js";
import { RoomHeader } from "./design/RoomHeader.js";
import { saveSession, type ClientSession } from "./session.js";

vi.mock("@lume/contracts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@lume/contracts")>(),
  ...await import("../../../packages/contracts/src/room-code.js"),
}));
vi.mock("./realtime/useRoomChannel.js", () => ({ useRoomChannel: () => ({ error: null }) }));
vi.mock("./screens/RoomScreen.js", () => ({ RoomScreen: () => <p>Joined room</p> }));

const user: ClientSession["user"] = {
  id: "test-user", displayName: "Viewer", username: null, telegramId: null, locale: "ru", themeId: "ember",
};
const session = { accessToken: "test-token", user };
const room = {
  id: "test-room", title: "Watch party", code: "7kq2mx", isPublic: false,
  hostId: user.id, status: "open" as const, memberCount: 1, createdAt: "2026-11-21T12:00:00.000Z",
};

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
});

afterEach(() => {
  Reflect.deleteProperty(window, "Telegram");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("room invite navigation", () => {
  it.each(["/join/7kq2mxab", "/join/%E0%A4%A", "/join/7kq2mx/extra"])(
    "shows recovery without calling the API for %s",
    async (path) => {
      saveSession(session);
      window.sessionStorage.setItem("lume-pending-room", "7kq2mx");
      window.history.replaceState({}, "", path);
      const join = vi.spyOn(api, "joinRoom").mockResolvedValue({ room });
      render(<App />);

      expect(await screen.findByRole("heading", { name: "Комната не найдена" })).toBeVisible();
      expect(join).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem("lume-pending-room")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Ввести другой код" }));
      expect(screen.getByRole("textbox", { name: "Код комнаты" })).toHaveValue("");
    },
  );

  it("persists an encoded grouped invite then joins canonically after sign-in", async () => {
    window.history.replaceState({}, "", "/join/%207KQ%2D2MX%20");
    const join = vi.spyOn(api, "joinRoom").mockResolvedValue({ room });
    vi.spyOn(api, "devLogin").mockResolvedValue(session);
    render(<App />);

    const signIn = await screen.findByRole("button", { name: "Войти через Telegram" });
    expect(window.sessionStorage.getItem("lume-pending-room")).toBe("7kq2mx");
    expect(join).not.toHaveBeenCalled();
    await userEvent.click(signIn);
    expect(await screen.findByText("Joined room")).toBeVisible();
    expect(join).toHaveBeenCalledExactlyOnceWith("test-token", "7kq2mx");
    expect(window.sessionStorage.getItem("lume-pending-room")).toBeNull();
  });

  it("offers recovery if the server rejects a valid code", async () => {
    saveSession(session);
    window.history.replaceState({}, "", "/join/7kq2mx");
    const join = vi.spyOn(api, "joinRoom").mockRejectedValue(new ClientError("not_found"));
    render(<App />);

    await waitFor(() => expect(join).toHaveBeenCalledExactlyOnceWith("test-token", "7kq2mx"));
    expect(await screen.findByRole("heading", { name: "Комната не найдена" })).toBeVisible();
  });

  it("does not send duplicate join requests when effects remount", async () => {
    saveSession(session);
    window.history.replaceState({}, "", "/join/7kq2mx");
    const join = vi.spyOn(api, "joinRoom").mockResolvedValue({ room });
    render(<StrictMode><App /></StrictMode>);

    expect(await screen.findByText("Joined room")).toBeVisible();
    expect(join).toHaveBeenCalledExactlyOnceWith("test-token", "7kq2mx");
  });

  it("blocks incomplete manual entries before forwarding a corrected code", async () => {
    saveSession(session);
    window.history.replaceState({}, "", "/join");
    const join = vi.spyOn(api, "joinRoom").mockResolvedValue({ room });
    const visitor = userEvent.setup();
    render(<App />);

    const field = screen.getByRole("textbox", { name: "Код комнаты" });
    await visitor.type(field, "7KQ-2M");
    await visitor.click(screen.getByTestId("lobby-join"));
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(join).not.toHaveBeenCalled();
    await visitor.type(field, "X");
    await visitor.click(screen.getByTestId("lobby-join"));
    expect(await screen.findByText("Joined room")).toBeVisible();
    expect(join).toHaveBeenCalledExactlyOnceWith("test-token", "7kq2mx");
  });

  it.each([
    ["room_7KQ-2MX", "Joined room"],
    ["room_7kq2mxab", "Комната не найдена"],
    ["user_7kq2mx", "Найти видео или комнату"],
  ])("handles the Telegram start parameter %s", async (start, expected) => {
    saveSession(session);
    Reflect.set(window, "Telegram", { WebApp: { initDataUnsafe: { start_param: start } } });
    const join = vi.spyOn(api, "joinRoom").mockResolvedValue({ room });
    render(<App />);

    if (start.startsWith("user_")) {
      expect(await screen.findByRole("textbox", { name: expected })).toBeVisible();
    } else {
      expect(await screen.findByText(expected)).toBeVisible();
    }
    if (expected === "Joined room") expect(join).toHaveBeenCalledExactlyOnceWith("test-token", "7kq2mx");
    else expect(join).not.toHaveBeenCalled();
  });

  it("opens the bot's URL start parameter only under an authenticated session", async () => {
    window.history.replaceState({}, "", "/?tgWebAppStartParam=room_7kq2mx");
    const join = vi.spyOn(api, "joinRoom").mockResolvedValue({ room });
    vi.spyOn(api, "devLogin").mockResolvedValue(session);
    render(<App />);

    const signIn = await screen.findByRole("button", { name: "Войти через Telegram" });
    expect(window.sessionStorage.getItem("lume-pending-room")).toBe("7kq2mx");
    expect(join).not.toHaveBeenCalled();
    await userEvent.click(signIn);
    expect(await screen.findByText("Joined room")).toBeVisible();
    expect(join).toHaveBeenCalledExactlyOnceWith("test-token", "7kq2mx");
  });

  it.each([
    ["cinema", 1440],
    ["cinema", 390],
    ["gruvbox", 1440],
    ["telerave", 390],
  ])("renders the code control and formatted fixture at %s width %i", async (style, width) => {
    vi.stubGlobal("innerWidth", width);
    window.history.replaceState({}, "", `/?shot=home&style=${style}`);
    const { container } = render(<App />);

    expect(screen.getByRole("textbox", { name: "Код комнаты" })).toBeVisible();
    expect(container.querySelectorAll("[data-code-cells] > [data-code-cell]")).toHaveLength(6);
    expect(await screen.findByText("7KQ-2MX", { exact: true })).toBeVisible();
  });
});

describe("room invite sharing", () => {
  it("shows a formatted code and copies exactly one canonical URL", async () => {
    const visitor = userEvent.setup();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const noop = () => undefined;
    render(<RoomHeader title={room.title} code="7kq2mx" memberCount={1} synced onPeople={noop} onLeave={noop} />);

    const invite = screen.getByTestId("session-dock-invite");
    expect(screen.getByTestId("room-code")).toHaveTextContent("7KQ-2MX");
    await visitor.click(invite);
    expect(clipboard).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/join/7kq2mx`);
    expect(screen.getByText("Ссылка скопирована")).toBeVisible();
  });
});
