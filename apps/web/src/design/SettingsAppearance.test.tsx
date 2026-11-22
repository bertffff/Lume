import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { I18nProvider } from "../i18n/context.js";
import { SettingsScreen } from "../screens/settings/SettingsScreen.js";

test("changes interface style and color mode independently in settings", () => {
  const onStyle = vi.fn();
  const onMode = vi.fn();
  render(<I18nProvider locale="ru"><SettingsScreen style="cinema" mode="light" onStyle={onStyle} onMode={onMode} /></I18nProvider>);

  expect(screen.getByRole("button", { name: "Кинозал" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Светлая" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "TeleRave-v2" }));
  expect(onStyle).toHaveBeenCalledWith("telerave");
  expect(onMode).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Как в системе" }));
  expect(onMode).toHaveBeenCalledWith("system");
  expect(onStyle).toHaveBeenCalledTimes(1);
});
