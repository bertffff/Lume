import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen.js";
import type { HomeProps } from "./types.js";

const noop = () => undefined;

function props(over: Partial<HomeProps> = {}): HomeProps {
  return {
    displayName: "Альберт Вопилов",
    hour: 20,
    splash: null,
    friends: [],
    resume: null,
    resuming: false,
    onResume: noop,
    catalog: <p>каталог</p>,
    level: 1,
    heat: [],
    reminders: [],
    stats: { usersOnline: 0, activeRooms: 0, totalVideos: 0, totalWatchHours: 0 },
    statsReady: true,
    guest: { name: "", onName: noop, onSignIn: noop, onTelegram: noop },
    join: { code: "", invalid: false, onCode: noop, onSubmit: noop },
    people: [],
    onSearchPeople: noop,
    onCreate: noop,
    onGo: noop,
    onJoinFriend: noop,
    onInviteFriend: noop,
    onRemoveFriend: noop,
    ...over,
  };
}

describe("HomeScreen greeting and splash", () => {
  it.each([
    [7, "Доброе утро, Альберт"],
    [13, "Добрый день, Альберт"],
    [20, "Добрый вечер, Альберт"],
    [2, "Доброй ночи, Альберт"],
  ])("greets at %i o'clock with «%s»", (hour, heading) => {
    render(<HomeScreen {...props({ hour })} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(heading);
  });

  it("greets a guest without a name", () => {
    render(<HomeScreen {...props({ displayName: null, hour: 20 })} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Добрый вечер$/);
  });

  it("shows the splash when there is one and nothing when there is not", () => {
    const { rerender } = render(<HomeScreen {...props({ splash: "Тихо, тут смотрят." })} />);
    expect(screen.getByTestId("home-splash")).toHaveTextContent("Тихо, тут смотрят.");
    rerender(<HomeScreen {...props({ splash: null })} />);
    expect(screen.queryByTestId("home-splash")).toBeNull();
  });

  it("offers the create action and calls back once", () => {
    const onCreate = vi.fn();
    render(<HomeScreen {...props({ onCreate })} />);
    screen.getByTestId("home-create-open").click();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
