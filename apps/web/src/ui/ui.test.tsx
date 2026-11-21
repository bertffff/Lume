import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.js";
import { Input, Select, Textarea } from "./Field.js";
import { Badge, Card, Toggle } from "./Surfaces.js";
import { ConfirmDialog, Modal } from "./Modal.js";
import { EmptyState, ErrorState } from "./States.js";
import { ToastProvider, useToast } from "./Toast.js";

describe("Button", () => {
  it("is a button by default and runs its handler", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Открыть</Button>);
    const button = screen.getByRole("button", { name: "Открыть" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks clicks and marks itself busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Сохранить
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Сохранить" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Toggle", () => {
  it("is a switch with keyboard support", async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Toggle checked={on} onChange={setOn} label="Реакции" />;
    }
    render(<Harness />);
    const toggle = screen.getByRole("switch", { name: "Реакции" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    toggle.focus();
    await userEvent.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});

describe("fields", () => {
  it("links the error to the input and marks it invalid", () => {
    render(<Input label="Почта" value="" onChange={() => undefined} error="Неверный адрес" />);
    const input = screen.getByLabelText("Почта");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const described = input.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(described)).toHaveTextContent("Неверный адрес");
    expect(screen.getByRole("alert")).toHaveTextContent("Неверный адрес");
  });

  it("renders textarea and select with labels", () => {
    render(
      <>
        <Textarea label="Описание" value="" onChange={() => undefined} />
        <Select label="Роль" value="host" onChange={() => undefined}>
          <option value="host">Хост</option>
        </Select>
      </>,
    );
    expect(screen.getByLabelText("Описание").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Роль").tagName).toBe("SELECT");
  });
});

describe("badges and cards", () => {
  it("clamps counts and renders a titled card", () => {
    render(
      <>
        <Badge count={130} tone="social" />
        <Card title="Очередь">пусто</Card>
      </>,
    );
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Очередь" })).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("is a labelled dialog, closes on Escape, and restores focus", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Открыть
          </button>
          <Modal open={open} title="Настройки" onClose={() => setOpen(false)}>
            <p>Тело</p>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Открыть" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Настройки" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("traps Tab inside the dialog", async () => {
    render(
      <Modal open title="Ловушка" onClose={() => undefined}>
        <button type="button">Первый</button>
        <button type="button">Последний</button>
      </Modal>,
    );
    const buttons = screen.getAllByRole("button");
    expect(document.body.style.overflow).toBe("hidden");
    const last = buttons[buttons.length - 1];
    last?.focus();
    await userEvent.tab();
    expect(buttons[0]).toHaveFocus();
  });

  it("confirms and cancels", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Забанить?"
        body="Действие необратимо"
        confirmLabel="Забанить"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Забанить" }));
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("states", () => {
  it("renders empty and error states with actions", async () => {
    const retry = vi.fn();
    render(
      <>
        <EmptyState title="Пусто" body="Пока ничего" />
        <ErrorState title="Ошибка" body="Нет сети" onRetry={retry} />
      </>,
    );
    expect(screen.getByTestId("empty-state")).toHaveTextContent("Пока ничего");
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(retry).toHaveBeenCalled();
  });
});

describe("toasts", () => {
  it("announces a pushed message politely", async () => {
    function Harness() {
      const { push } = useToast();
      return (
        <button type="button" onClick={() => push("Ссылка скопирована", "success")}>
          Позвать
        </button>
      );
    }
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Позвать" }));
    expect(screen.getByTestId("toast")).toHaveTextContent("Ссылка скопирована");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
