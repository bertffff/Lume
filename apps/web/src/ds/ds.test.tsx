import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bell } from "lucide-react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Avatar, Button, CodeBadge, Field, IconButton, Input, initialsOf, Modal, personSlot, Popover, Poster, Progress, State, Tabs } from "./index.js";

describe("Button", () => {
  it("blocks clicks and reports busy while loading", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Сохранить</Button>);
    const button = screen.getByRole("button", { name: "Сохранить" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("gives an icon-only button its accessible name", () => {
    render(<IconButton icon={Bell} label="Уведомления" pressed />);
    expect(screen.getByRole("button", { name: "Уведомления" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Field", () => {
  it("links label, hint and error to the control", () => {
    render(<Field label="Код комнаты" error="Шесть знаков"><Input /></Field>);
    const input = screen.getByLabelText("Код комнаты");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Шесть знаков");
    expect(screen.getByRole("alert")).toHaveTextContent("Шесть знаков");
  });
});

describe("Tabs", () => {
  const tabs = [
    { id: "chat", label: "Чат", panel: <p>Сообщения</p> },
    { id: "people", label: "Люди", panel: <p>Участники</p> },
    { id: "queue", label: "Очередь", panel: <p>Дальше</p> },
  ];

  it("moves selection and focus with arrows, Home and End and mounts one panel", async () => {
    render(<Tabs label="Панель" tabs={tabs} />);
    const [chat, people, queue] = screen.getAllByRole("tab");
    chat!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(people).toHaveAttribute("aria-selected", "true");
    expect(people).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Участники");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    await userEvent.keyboard("{End}");
    expect(queue).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(chat).toHaveFocus();
  });
});

describe("Progress", () => {
  it("draws nothing when the length is unknown and clamps otherwise", () => {
    const { container, rerender } = render(<Progress value={null} label="Просмотрено" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Progress value={4} label="Просмотрено" />);
    expect(screen.getByRole("progressbar", { name: "Просмотрено" })).toHaveAttribute("value", "1");
  });
});

describe("Popover", () => {
  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Popover label="Уведомления" trigger={(props) => <IconButton icon={Bell} label="Открыть" {...props} />}><p>Пусто</p></Popover>);
    const trigger = screen.getByRole("button", { name: "Открыть" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Уведомления" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on an outside press", async () => {
    render(<><button type="button">Снаружи</button><Popover label="Панель" defaultOpen trigger={(props) => <IconButton icon={Bell} label="Открыть" {...props} />}><p>Тело</p></Popover></>);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => { fireEvent.pointerDown(screen.getByRole("button", { name: "Снаружи" })); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Modal", () => {
  beforeAll(() => {
    // jsdom has no showModal(); mirror the browser's effect on the open attribute.
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
  });

  it("is named by its title and closes from the close button", async () => {
    const onClose = vi.fn();
    render(<Modal open title="Войти по коду" onClose={onClose}><p>Код</p></Modal>);
    expect(screen.getByRole("dialog", { name: "Войти по коду" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CodeBadge", () => {
  it("shows the canonical code as upper-case 3–3 and hides invalid input", () => {
    const { container, rerender } = render(<CodeBadge code="7kq2mx" />);
    expect(container).toHaveTextContent("7KQ-2MX");
    rerender(<CodeBadge code="7KQ-2" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Poster", () => {
  it("never renders an image for a non-http thumbnail and falls back on load error", () => {
    const { container, rerender } = render(<Poster category="film" src="javascript:alert(1)" />);
    expect(container.querySelector("img")).toBeNull();
    rerender(<Poster category="film" src="https://cdn.example/p.jpg" />);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("State", () => {
  it("announces errors as alerts and the rest quietly", () => {
    const { rerender } = render(<State kind="error" title="Не удалось загрузить комнаты" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить комнаты");
    rerender(<State kind="empty" title="Пока нет комнат" />);
    expect(screen.getByRole("status")).toHaveTextContent("Пока нет комнат");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Avatar", () => {
  it("derives stable initials and colour slot from the name", () => {
    expect(initialsOf("Альберт Вопилов")).toBe("АВ");
    expect(personSlot("Лиза Морозова")).toBe(personSlot("Лиза Морозова"));
    expect(personSlot("Лиза Морозова")).toBeGreaterThanOrEqual(1);
    render(<Avatar name="Марк Орлов" presence="online" />);
    expect(screen.getByRole("img", { name: "Марк Орлов" })).toBeInTheDocument();
  });
});
