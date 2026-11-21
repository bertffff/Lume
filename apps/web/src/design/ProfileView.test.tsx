import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ProfileView, type ProfileViewProps } from "./ProfileView.js";

const props: ProfileViewProps = {
  labels: {
    tabsLabel: "Профиль",
    tabs: { overview: "Обзор", history: "История", friends: "Друзья", awards: "Достижения" },
    season: "Сезон",
    seasonEmpty: "Нет данных за сезон",
    seasonScore: (score) => `Активность: ${score}`,
  },
  locale: "ru-RU",
  profileCard: <h2>Анна</h2>,
  achievements: <p>Первый сеанс · 1 из 3</p>,
  kpis: [
    { label: "Уровень", value: 2 },
    { label: "Опыт", value: "120 XP" },
    { label: "Награды", value: "1 из 3" },
  ],
  season: [
    { day: "2026-01-09", score: 0 },
    { day: "2026-01-10", score: 4 },
  ],
  settings: <button type="button">Тема</button>,
  history: <p>История просмотров</p>,
  friends: <p>Список друзей</p>,
  awards: <p>Все награды</p>,
};

it("exposes four linked tabs and shows only the selected panel", async () => {
  const user = userEvent.setup();
  render(<ProfileView {...props} />);
  const tabs = within(screen.getByRole("tablist", { name: "Профиль" }));
  expect(tabs.getAllByRole("tab")).toHaveLength(4);
  expect(screen.getByRole("tab", { name: "Обзор", selected: true })).toBeInTheDocument();
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);

  for (const [name, text] of [
    ["История", "История просмотров"],
    ["Друзья", "Список друзей"],
    ["Достижения", "Все награды"],
  ] as const) {
    const tab = tabs.getByRole("tab", { name });
    await user.click(tab);
    const panel = screen.getByRole("tabpanel", { name });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    expect(within(panel).getByText(text)).toBeVisible();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  }
  expect(screen.getByRole("heading", { name: "Анна" })).toBeVisible();
  expect(screen.getByText("Первый сеанс · 1 из 3")).toBeVisible();
});

it("moves focus and selection with wraparound arrows, Home and End", async () => {
  const user = userEvent.setup();
  render(<ProfileView {...props} />);
  await user.tab();
  expect(screen.getByRole("tab", { name: "Обзор" })).toHaveFocus();
  for (const [key, name] of [
    ["ArrowLeft", "Достижения"],
    ["ArrowRight", "Обзор"],
    ["ArrowRight", "История"],
    ["End", "Достижения"],
    ["Home", "Обзор"],
  ] as const) {
    await user.keyboard(`{${key}}`);
    expect(screen.getByRole("tab", { name, selected: true })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name })).toBeVisible();
    expect(screen.getAllByRole("tab", { selected: false }).map((tab) => tab.tabIndex)).toEqual([-1, -1, -1]);
  }
  await user.tab();
  expect(screen.getByRole("tabpanel", { name: "Обзор" })).toHaveFocus();
});

it("exposes actual dates and scores on focus and hover, including a zero day", async () => {
  const user = userEvent.setup();
  render(<ProfileView {...props} />);
  const day = screen.getByRole("button", { name: "10 января 2026 г." });
  expect(day).toHaveAccessibleDescription("Активность: 4");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

  await user.tab(); // selected tab
  await user.tab(); // overview panel
  await user.tab(); // first dated cell
  await user.tab();
  expect(day).toHaveFocus();
  expect(screen.getByRole("tooltip")).toHaveTextContent("10 января 2026 г.");
  expect(screen.getByRole("tooltip")).toHaveTextContent("Активность: 4");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(day).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Тема" })).toHaveFocus();

  const zeroDay = screen.getByRole("button", { name: "9 января 2026 г." });
  await user.hover(zeroDay);
  const hoveredTooltip = screen.getByRole("tooltip");
  expect(hoveredTooltip).toHaveTextContent("9 января 2026 г.");
  expect(hoveredTooltip).toHaveTextContent("Активность: 0");
  // user-event does not populate relatedTarget when moving between elements.
  fireEvent.mouseOut(zeroDay, { relatedTarget: hoveredTooltip });
  fireEvent.mouseOver(hoveredTooltip, { relatedTarget: zeroDay });
  expect(hoveredTooltip).toBeVisible();
  fireEvent.mouseOut(hoveredTooltip, { relatedTarget: document.body });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("keeps the current tab and slotted content mounted across style changes", async () => {
  const user = userEvent.setup();
  const view = (style: string) => <div data-style={style}><ProfileView {...props} /></div>;
  const { rerender } = render(view("cinema"));
  const friends = screen.getByRole("tab", { name: "Друзья" });
  await user.click(friends);
  const friendsPanel = screen.getByRole("tabpanel", { name: "Друзья" });
  for (const style of ["gruvbox", "telerave"]) {
    rerender(view(style));
    expect(screen.getByRole("tab", { name: "Друзья", selected: true })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Друзья" })).toBe(friendsPanel);
  }
});

it("does not manufacture dates or KPI values for missing data", () => {
  render(<ProfileView {...props} season={[]} kpis={[
    { label: "Уровень", value: null },
    { label: "Опыт", value: "120 XP" },
    { label: "Награды", value: "1 из 3" },
  ]} />);
  const overview = within(screen.getByRole("tabpanel", { name: "Обзор" }));
  expect(overview.getAllByRole("term")).toHaveLength(3);
  expect(overview.getByText("120 XP")).toBeVisible();
  const season = within(overview.getByRole("region", { name: "Сезон" }));
  expect(season.getByText("Нет данных за сезон")).toBeVisible();
  expect(season.queryByRole("button")).not.toBeInTheDocument();
  expect(overview.queryByText(/^0/)).not.toBeInTheDocument();
});
