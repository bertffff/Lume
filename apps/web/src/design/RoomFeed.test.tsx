import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomFeed, type RoomFeedLoader, type RoomFeedPage, type RoomFeedRoom } from "./RoomFeed.js";

const first: RoomFeedRoom = { id: "1", code: "7kq2mx", title: "Первый зал", category: "film", memberCount: 2, isFull: false };
const second: RoomFeedRoom = { id: "2", code: "7kq2my", title: "Второй зал", category: "music", isFull: false };

function roomPage(rooms: RoomFeedRoom[], nextCursor: string | null = null): RoomFeedPage {
  return { rooms, nextCursor };
}

function deferredPage() {
  let resolve!: (page: RoomFeedPage) => void;
  const promise = new Promise<RoomFeedPage>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(loadPage: RoomFeedLoader, signedIn = true) {
  const callbacks = { onOpenRoom: vi.fn(), onSignIn: vi.fn() };
  return { ...callbacks, ...render(<RoomFeed loadPage={loadPage} signedIn={signedIn} {...callbacks} />) };
}

function mockObserver() {
  const callbacks: IntersectionObserverCallback[] = [];
  const observe = vi.fn();
  const disconnect = vi.fn();
  class Observer {
    constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
    observe = observe;
    disconnect = disconnect;
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  const emit = (isIntersecting = true, index = callbacks.length - 1) => {
    callbacks[index]?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  };
  return { observe, disconnect, emit };
}

afterEach(() => vi.unstubAllGlobals());

describe("RoomFeed", () => {
  it("shows loading, truthful room details, accessible join names, and no join for a full room", async () => {
    const user = userEvent.setup();
    const request = deferredPage();
    const { onOpenRoom } = setup(vi.fn<RoomFeedLoader>().mockReturnValue(request.promise));
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем комнаты");

    const fullRoom = { ...second, isFull: true };
    await act(() => request.resolve(roomPage([first, fullRoom])));
    const join = screen.getByRole("button", { name: "Войти в комнату «Первый зал»" });
    expect(screen.getByText("2 в комнате")).toBeVisible();
    expect(screen.queryByText("0 в комнате")).not.toBeInTheDocument();
    expect(screen.getByText("Комната заполнена")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Войти в комнату «Второй зал»" })).not.toBeInTheDocument();
    await user.click(join);
    expect(onOpenRoom).toHaveBeenCalledWith(first);
  });

  it("uses the manual fallback without an observer and appends unseen IDs in order", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const user = userEvent.setup();
    const load = vi.fn<RoomFeedLoader>()
      .mockResolvedValueOnce(roomPage([first, first], "page-2"))
      .mockResolvedValueOnce(roomPage([{ ...first, title: "Повтор первого" }, second, second]));
    setup(load);
    await user.click(await screen.findByRole("button", { name: "Показать ещё" }));

    expect(await screen.findByRole("heading", { name: second.title })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Повтор первого")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((row) => row.querySelector("h3")?.textContent))
      .toEqual([first.title, second.title]);
    expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
    expect(load.mock.calls.map(([filter, cursor]) => [filter, cursor])).toEqual([["all", null], ["all", "page-2"]]);
  });

  it("loads from the sentinel once per cursor even when callbacks and manual activation overlap", async () => {
    const observer = mockObserver();
    const request = deferredPage();
    const load = vi.fn<RoomFeedLoader>()
      .mockResolvedValueOnce(roomPage([first], "page-2"))
      .mockReturnValueOnce(request.promise);
    setup(load);
    const more = await screen.findByRole("button", { name: "Показать ещё" });
    expect(observer.observe).toHaveBeenCalledTimes(1);
    act(() => observer.emit(false));
    expect(load).toHaveBeenCalledTimes(1);
    act(() => {
      observer.emit();
      observer.emit();
      more.click();
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем ещё");

    await act(() => request.resolve(roomPage([second], "page-2")));
    act(() => observer.emit());
    expect(screen.getByRole("heading", { name: second.title })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
    expect(observer.disconnect).toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("aborts the previous filter and ignores late success even when the loader ignores the signal", async () => {
    const user = userEvent.setup();
    const request = deferredPage();
    const load = vi.fn<RoomFeedLoader>()
      .mockResolvedValueOnce(roomPage([first], "old-cursor"))
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce(roomPage([second]));
    setup(load);
    await user.click(await screen.findByRole("button", { name: "Показать ещё" }));
    await user.click(screen.getByRole("button", { name: "Друзья" }));
    expect(screen.getByRole("button", { name: "Друзья" })).toHaveAttribute("aria-pressed", "true");
    expect(load.mock.calls[1]?.[2].aborted).toBe(true);
    expect(load.mock.calls[2]?.slice(0, 2)).toEqual(["friends", null]);
    expect(await screen.findByRole("heading", { name: second.title })).toBeVisible();

    await act(() => request.resolve(roomPage([first], "stale-cursor")));
    expect(screen.queryByRole("heading", { name: first.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
  });

  it("keeps previous rows after failure and waits for manual retry of the same cursor", async () => {
    const user = userEvent.setup();
    const observer = mockObserver();
    const load = vi.fn<RoomFeedLoader>()
      .mockResolvedValueOnce(roomPage([first], "retry-cursor"))
      .mockRejectedValueOnce(new Error("not for display"))
      .mockResolvedValueOnce(roomPage([second]));
    setup(load);
    await screen.findByRole("button", { name: "Показать ещё" });
    act(() => observer.emit());

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить комнаты");
    expect(screen.getByRole("heading", { name: first.title })).toBeVisible();
    act(() => observer.emit());
    expect(load).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Повторить загрузку" }));
    expect(await screen.findByRole("heading", { name: second.title })).toBeVisible();
    expect(screen.getByRole("heading", { name: first.title })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(load.mock.calls.map(([, cursor]) => cursor)).toEqual([null, "retry-cursor", "retry-cursor"]);
  });

  it("keeps the focused initial retry control while retrying, without inventing rows", async () => {
    const user = userEvent.setup();
    const request = deferredPage();
    const load = vi.fn<RoomFeedLoader>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockReturnValueOnce(request.promise);
    const view = setup(load);
    const retry = await screen.findByRole("button", { name: "Повторить загрузку" });
    await user.click(retry);
    expect(retry).toHaveFocus();
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Загружаем комнаты");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    view.unmount();
    expect(load.mock.calls[1]?.[2].aborted).toBe(true);
    await act(() => request.resolve(roomPage([first])));
  });

  it("announces an empty catalog and offers sign-in instead of fetching a guest's Friends page", async () => {
    const user = userEvent.setup();
    const load = vi.fn<RoomFeedLoader>().mockResolvedValue(roomPage([]));
    const { onSignIn } = setup(load, false);
    expect(await screen.findByText("Пока нет открытых комнат")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Друзья" }));
    expect(screen.getByText("Войдите, чтобы увидеть комнаты друзей")).toBeVisible();
    expect(load).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
