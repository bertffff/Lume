import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RoomCodeInput } from "./RoomCodeInput.js";

// Use the real parser source without requiring a concurrent workspace build of contracts/dist.
vi.mock("@lume/contracts", () => import("../../../../packages/contracts/src/room-code.js"));

function Harness() {
  const [value, setValue] = useState("");
  return <RoomCodeInput value={value} onChange={setValue} />;
}

function cells(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-code-cell]"), (cell) => cell.textContent);
}

describe("RoomCodeInput", () => {
  it("offers one keyboard input with six decorative cells and a 3–3 separator", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const field = screen.getByRole("textbox", { name: "Код комнаты" });
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(cells(container)).toEqual(["", "", "", "", "", ""]);
    expect(container.querySelector("[data-code-cells]")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[data-code-separator]")).toHaveTextContent("-");

    await user.tab();
    expect(field).toHaveFocus();
    await user.keyboard("7kq2mx");
    expect(field).toHaveValue("7kq2mx");
    expect(cells(container)).toEqual(["7", "K", "Q", "2", "M", "X"]);
    await user.keyboard("{Backspace}");
    expect(cells(container)).toEqual(["7", "K", "Q", "2", "M", ""]);
  });

  it("keeps a pasted grouped code editable while displaying only its six symbols", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const field = screen.getByRole("textbox");
    await user.click(field);
    await user.paste(" 7KQ-2MX ");
    expect(field).toHaveValue(" 7KQ-2MX ");
    expect(cells(container)).toEqual(["7", "K", "Q", "2", "M", "X"]);
    expect(field).not.toHaveAttribute("aria-invalid", "true");
  });

  it.each(["7KQ2MXab", "7K-Q2MX", "7KQ--2MX", "7KQ-2M0", "7KQ-2MI", "K7Q-2MX"])(
    "shows invalid text without truncating, repairing, or guessing it: %s",
    async (value) => {
      const user = userEvent.setup();
      const { container } = render(<Harness />);
      const field = screen.getByRole("textbox");
      await user.click(field);
      await user.paste(value);
      expect(field).toHaveValue(value);
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription(/7KQ-2MX/);
      expect(field.parentElement).toHaveAttribute("data-raw", "true");
      expect(cells(container)).toEqual(["", "", "", "", "", ""]);
    },
  );

  it("keeps a pasted line break from silently turning two fragments into a valid code", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const field = screen.getByRole("textbox");
    await user.click(field);
    await user.paste("7KQ\n2MX");
    expect(field).toHaveValue("7KQ 2MX");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(cells(container)).toEqual(["", "", "", "", "", ""]);
  });
});
