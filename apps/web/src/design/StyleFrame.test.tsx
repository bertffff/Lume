import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { StyleFrame } from "./StyleFrame.js";
import { AppShell } from "../shell/AppShell.js";

test("preserves the room content node when entering the Gruvbox layout", () => {
  const stage = <div data-testid="player-mount" />;
  const view = render(<StyleFrame style="cinema" screen="room">{stage}</StyleFrame>);
  const player = screen.getByTestId("player-mount");

  view.rerender(<StyleFrame style="gruvbox" screen="room">{stage}</StyleFrame>);

  expect(screen.getByTestId("player-mount")).toBe(player);
  expect(screen.getByText("NORMAL")).toBeInTheDocument();
  expect(screen.getByText("lume/room")).toBeInTheDocument();
});

test("the production app shell applies a selected layout without replacing main", () => {
  const { rerender } = render(<AppShell view="home">Список комнат</AppShell>);
  const main = screen.getByRole("main");
  rerender(<AppShell view="home" style="telerave">Список комнат</AppShell>);

  expect(screen.getByRole("main")).toBe(main);
  expect(main.closest(".design-app")).toHaveAttribute("data-frame-style", "telerave");
});
