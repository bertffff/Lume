import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen.js";

it("hands the typed password to the sign-in handler", async () => {
  const onEmail = vi.fn((event: { preventDefault: () => void }, _password: string) => event.preventDefault());
  const user = userEvent.setup();
  render(<AuthScreen name="albert@example.com" onName={() => undefined} onTelegram={() => undefined} onEmail={onEmail} onRegister={() => undefined} />);
  await user.type(screen.getByLabelText("Пароль"), "s3cret-pass");
  await user.click(screen.getByTestId("lobby-sign-in"));
  expect(onEmail).toHaveBeenCalledTimes(1);
  expect(onEmail.mock.calls[0]?.[1]).toBe("s3cret-pass");
});
