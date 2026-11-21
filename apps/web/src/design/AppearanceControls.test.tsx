import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AppearanceControls } from "./AppearanceControls.js";
import { StyleFrame } from "./StyleFrame.js";

it("operates the independent style and theme controls by keyboard", async () => {
  const user = userEvent.setup();
  const onStyle = vi.fn();
  const onMode = vi.fn();
  render(<AppearanceControls style="cinema" mode="system" onStyle={onStyle} onMode={onMode} />);
  const styles = within(screen.getByRole("group", { name: "Стиль интерфейса" }));
  expect(styles.getByRole("button", { name: "Кинозал" })).toHaveAttribute("aria-pressed", "true");
  await user.tab();
  await user.tab();
  await user.tab();
  expect(styles.getByRole("button", { name: "TeleRave-v2" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onStyle).toHaveBeenCalledWith("telerave");
  expect(onMode).not.toHaveBeenCalled();

  await user.tab();
  const modes = within(screen.getByRole("group", { name: "Тема" }));
  expect(modes.getByRole("button", { name: "Тёмная" })).toHaveFocus();
  expect(modes.getByRole("button", { name: "Как в системе" })).toHaveAttribute("aria-pressed", "true");
  await user.keyboard(" ");
  expect(onMode).toHaveBeenCalledWith("dark");
  expect(onStyle).toHaveBeenCalledOnce();
});

it("preserves the live content node, focus and state across frame changes", async () => {
  const user = userEvent.setup();
  const view = (style: "cinema" | "gruvbox" | "telerave") => (
    <StyleFrame style={style} screen="room" header={<button type="button">Назад</button>}>
      <label>Сообщение <input /></label>
    </StyleFrame>
  );
  const { rerender } = render(view("cinema"));
  const input = screen.getByRole("textbox", { name: "Сообщение" });
  const action = screen.getByRole("button", { name: "Назад" });
  await user.type(input, "Черновик");

  rerender(view("gruvbox"));
  expect(screen.getByText("lume/room")).toBeVisible();
  rerender(view("telerave"));
  expect(screen.queryByText("lume/room")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Сообщение" })).toBe(input);
  expect(screen.getByRole("button", { name: "Назад" })).toBe(action);
  expect(input).toHaveFocus();
  expect(input).toHaveValue("Черновик");
});
