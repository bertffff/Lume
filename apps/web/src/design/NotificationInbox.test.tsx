import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import {
  NotificationInboxPage,
  NotificationInboxPopover,
  type NotificationInboxProps,
} from "./NotificationInbox.js";

const inbox: NotificationInboxProps = {
  icon: <svg />,
  items: [],
  unreadCount: 0,
  labels: {
    title: "Уведомления",
    unreadCount: (count) => `Непрочитанных: ${count}`,
    read: "Прочитано",
    unread: "Не прочитано",
    markRead: "Отметить прочитанным",
    markAllRead: "Отметить все прочитанными",
    empty: "Уведомлений пока нет",
    loading: "Загружаем уведомления",
    error: "Не удалось загрузить уведомления",
    retry: "Повторить",
  },
};

const notification = {
  id: "notification-1",
  title: "Приглашение",
  body: "Лиза приглашает вас в комнату",
  read: false,
};

function Popover({ onOpenAll = () => {} }: { onOpenAll?: () => void }) {
  return <NotificationInboxPopover {...inbox} viewAllLabel="Все" onOpenAll={onOpenAll} />;
}

it("opens a named non-modal panel by keyboard and restores focus on Escape", async () => {
  const user = userEvent.setup();
  render(<Popover />);
  const bell = screen.getByRole("button", { name: "Уведомления" });
  expect(bell).toHaveAttribute("aria-expanded", "false");
  await user.tab();
  await user.keyboard("{Enter}");

  const panel = screen.getByRole("dialog", { name: "Уведомления" });
  expect(panel).toHaveFocus();
  expect(panel).not.toHaveAttribute("aria-modal", "true");
  expect(bell).toHaveAttribute("aria-controls", panel.id);
  await user.tab();
  expect(screen.getByRole("button", { name: "Все" })).toHaveFocus();
  await user.keyboard("{Escape}");

  expect(panel).not.toBeInTheDocument();
  expect(bell).toHaveFocus();
  expect(bell).toHaveAttribute("aria-expanded", "false");
});

it("lets Tab leave the popover without wrapping or stealing outside focus", async () => {
  const user = userEvent.setup();
  render(<><Popover /><button type="button">Дальше</button></>);
  await user.click(screen.getByRole("button", { name: "Уведомления" }));
  await user.tab();
  await user.tab();
  expect(screen.getByRole("button", { name: "Дальше" })).toHaveFocus();
});

it("dismisses on an outside click and restores the bell without swallowing the outside action", async () => {
  const user = userEvent.setup();
  const onOutside = vi.fn();
  render(<><Popover /><button type="button" onClick={onOutside}>Дальше</button></>);
  const bell = screen.getByRole("button", { name: "Уведомления" });
  await user.click(bell);
  await user.click(screen.getByText("Уведомлений пока нет"));
  expect(screen.getByRole("dialog")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "Дальше" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(bell).toHaveFocus();
  expect(onOutside).toHaveBeenCalledOnce();
});

it("closes when All requests parent navigation", async () => {
  const user = userEvent.setup();
  const onOpenAll = vi.fn();
  render(<Popover onOpenAll={onOpenAll} />);
  await user.click(screen.getByRole("button", { name: "Уведомления" }));
  await user.click(screen.getByRole("button", { name: "Все" }));
  expect(onOpenAll).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("reflects parent read updates on both surfaces and keeps focus on the completed action", async () => {
  const user = userEvent.setup();
  const onMarkRead = vi.fn();
  function SharedFeed() {
    const [read, setRead] = useState(false);
    const props = {
      ...inbox,
      items: [{ ...notification, read }],
      unreadCount: read ? 0 : 1,
      onMarkRead: (id: string) => {
        onMarkRead(id);
        setRead(true);
      },
    };
    return <>
      <NotificationInboxPopover {...props} viewAllLabel="Все" onOpenAll={() => {}} />
      <NotificationInboxPage {...props} />
    </>;
  }

  render(<SharedFeed />);
  const page = within(screen.getByRole("region", { name: "Уведомления" }));
  const bell = screen.getByRole("button", { name: "Уведомления" });
  expect(bell).toHaveAccessibleDescription("Непрочитанных: 1");
  await user.click(bell);
  const panel = within(screen.getByRole("dialog"));
  expect(panel.getByText("Непрочитанных: 1")).toBeVisible();
  expect(page.getByText("Непрочитанных: 1")).toBeVisible();

  const markRead = panel.getByRole("button", { name: /Отметить прочитанным/ });
  await user.click(markRead);
  expect(onMarkRead).toHaveBeenCalledWith("notification-1");
  expect(markRead).toHaveFocus();
  expect(markRead).toHaveAttribute("aria-disabled", "true");
  await user.keyboard("{Enter}");
  expect(onMarkRead).toHaveBeenCalledOnce();
  expect(bell).not.toHaveAccessibleDescription();
  expect(panel.getByText("Непрочитанных: 0")).toBeVisible();
  expect(page.getByText("Непрочитанных: 0")).toBeVisible();
  expect(page.getByText("Прочитано")).toBeVisible();
});

it("shows only known timestamps and delegates the supplied item action", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const dateTime = "2026-11-21T18:00:00Z";
  const { container } = render(<NotificationInboxPage
    {...inbox}
    items={[
      { ...notification, timestamp: { dateTime, label: "21 ноября, 18:00" }, action: { label: "Открыть комнату", onSelect } },
      { ...notification, id: "2", title: "Без времени" },
      { ...notification, id: "3", title: "Некорректное время", timestamp: { dateTime: "unknown", label: "Сегодня" } },
    ]}
  />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Уведомления");
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByText("21 ноября, 18:00")).toHaveAttribute("datetime", dateTime);
  expect(container.querySelectorAll("time")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Открыть комнату" }));
  expect(onSelect).toHaveBeenCalledWith("notification-1");
});

it("shows loading and retry states without inventing a count or presenting them as empty", async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();
  const { rerender } = render(<NotificationInboxPage {...inbox} status="loading" unreadCount={null} />);
  expect(screen.getByRole("status")).toHaveTextContent("Загружаем уведомления");
  expect(screen.queryByText(/Непрочитанных/)).not.toBeInTheDocument();
  expect(screen.queryByText(inbox.labels.empty)).not.toBeInTheDocument();

  rerender(<NotificationInboxPage {...inbox} status="error" unreadCount={null} onRetry={onRetry} />);
  expect(screen.getByRole("status")).toHaveTextContent("Не удалось загрузить уведомления");
  await user.click(screen.getByRole("button", { name: "Повторить" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it("marks all from either surface using the server count even when every visible item is read", async () => {
  const user = userEvent.setup();
  const onMarkAllRead = vi.fn();
  function SharedFeed() {
    const [unreadCount, setUnreadCount] = useState(3);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const props = {
      ...inbox,
      items: [{ ...notification, read: true }],
      unreadCount,
      markingAllRead,
      onMarkAllRead: () => { onMarkAllRead(); setMarkingAllRead(true); },
    };
    return <>
      <NotificationInboxPopover {...props} viewAllLabel="Все" onOpenAll={() => {}} />
      <NotificationInboxPage {...props} />
      <button type="button" onClick={() => { setUnreadCount(0); setMarkingAllRead(false); }}>Обновить счётчик</button>
    </>;
  }

  render(<SharedFeed />);
  const bell = screen.getByRole("button", { name: inbox.labels.title });
  await user.click(bell);
  const panel = within(screen.getByRole("dialog"));
  const page = within(screen.getByRole("region", { name: inbox.labels.title }));
  const action = { name: inbox.labels.markAllRead };
  await user.click(panel.getByRole("button", action));
  expect(panel.getByRole("button", action)).toHaveAttribute("aria-busy", "true");
  expect(page.getByRole("button", action)).toHaveAttribute("aria-disabled", "true");
  await user.click(page.getByRole("button", action));
  expect(onMarkAllRead).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Обновить счётчик" }));
  expect(bell).not.toHaveAccessibleDescription();
  expect(page.getByRole("button", action)).toHaveAttribute("aria-disabled", "true");
  expect(page.getByText("Непрочитанных: 0")).toBeVisible();
});
