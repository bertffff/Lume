import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateRoomWizard, type CreateRoomWizardLabels } from "./CreateRoomWizard.js";

const labels = {
  steps: { video: "Видео", access: "Доступ", rights: "Права" },
  presetOptions: {
    cinema: { name: "Киноночь", hint: "Закрытый показ на 12 человек" },
    party: { name: "Вечеринка", hint: "Публичная комната на 50 человек" },
    closed: { name: "Закрытый", hint: "Только по коду, 6 человек" },
    moderated: { name: "С модерацией", hint: "Медленный режим 10 секунд" },
  },
  videoUrl: "Ссылка на видео (необязательно)",
  category: "Категория",
  categories: { auto: "Определить автоматически", film: "Кино", music: "Музыка", vlog: "Влоги", other: "Другое" },
  invalidTitle: "Введите название до 120 символов",
  invalidVideoUrl: "Введите действительную ссылку на видео",
} satisfies CreateRoomWizardLabels;

function renderWizard(onSubmit = vi.fn()) {
  const user = userEvent.setup();
  render(<CreateRoomWizard open onClose={vi.fn()} onSubmit={onSubmit} labels={labels} />);
  return { user, onSubmit };
}

const next = () => screen.getByTestId("create-next");
const back = () => screen.getByTestId("create-back");

describe("CreateRoomWizard", () => {
  it("keeps the title, optional video, manual Other, access and permissions through back and next", async () => {
    const { user, onSubmit } = renderWizard();
    await user.type(screen.getByRole("textbox", { name: "Название" }), "  Ночной зал  ");
    await user.type(screen.getByRole("textbox", { name: labels.videoUrl }), "https://youtu.be/abcdefghijk");
    await user.selectOptions(screen.getByRole("combobox", { name: labels.category }), "other");
    await user.click(next());
    expect(screen.getByRole("heading", { name: "Доступ" })).toHaveFocus();
    await user.click(screen.getByRole("radio", { name: "По коду" }));
    await user.click(next());
    const queue = () => screen.getByTestId("create-permission-canQueue");
    await user.click(queue());
    await user.click(back());
    expect(screen.getByRole("radio", { name: "По коду" })).toBeChecked();
    await user.click(back());
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("  Ночной зал  ");
    expect(screen.getByRole("textbox", { name: labels.videoUrl })).toHaveValue("https://youtu.be/abcdefghijk");
    expect(screen.getByRole("combobox", { name: labels.category })).toHaveValue("other");
    await user.click(next());
    await user.click(next());
    expect(queue()).not.toBeChecked();
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Создать комнату" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      title: "Ночной зал",
      initialVideoUrl: "https://youtu.be/abcdefghijk",
      categorySelection: "other",
      isPublic: false,
      defaults: { canChat: true, canQueue: false, canSpeak: true, canReact: true, canSeek: false, canInvite: true },
    });
  });

  it("applies preset policy as editable defaults and submits auto with no video when omitted", async () => {
    const { user, onSubmit } = renderWizard();
    await user.click(screen.getByRole("button", { name: "Закрытый" }));
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveValue("Закрытый");
    expect(screen.getByTestId("create-preset-summary")).toHaveAttribute("data-max", "6");
    await user.click(next());
    expect(screen.getByRole("radio", { name: "По коду" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Публичная" }));
    await user.click(next());
    const speak = screen.getByTestId("create-permission-canSpeak");
    expect(speak).not.toBeChecked();
    await user.click(speak);
    await user.click(screen.getByRole("button", { name: "Создать комнату" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      title: "Закрытый",
      preset: "closed",
      categorySelection: "auto",
      isPublic: true,
      defaults: { canChat: true, canQueue: false, canSpeak: true, canReact: true, canSeek: false, canInvite: false },
    });
  });

  it("blocks invalid details, connects translated errors to fields, and clears each on edit", async () => {
    const { user, onSubmit } = renderWizard();
    await user.type(screen.getByRole("textbox", { name: labels.videoUrl }), "javascript:alert(1)");
    await user.click(next());
    const title = screen.getByRole("textbox", { name: "Название" });
    const video = screen.getByRole("textbox", { name: labels.videoUrl });
    expect(title).toHaveAccessibleDescription(labels.invalidTitle);
    expect(video).toHaveAccessibleDescription(labels.invalidVideoUrl);
    expect(title).toHaveFocus();
    await user.type(title, "Зал");
    expect(title).not.toHaveAttribute("aria-invalid");
    expect(video).toHaveAttribute("aria-invalid", "true");
    await user.clear(video);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(next());
    expect(screen.getByRole("heading", { name: "Доступ" })).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prevents repeated submission while pending and permits a retry without losing the draft", async () => {
    let finish: (result: { error: string }) => void = () => undefined;
    const firstAttempt = new Promise<{ error: string }>((resolve) => { finish = resolve; });
    const { user, onSubmit } = renderWizard(vi.fn().mockReturnValueOnce(firstAttempt).mockResolvedValueOnce(undefined));
    await user.type(screen.getByRole("textbox", { name: "Название" }), "Ночной зал");
    await user.click(next());
    await user.click(next());
    await user.dblClick(screen.getByTestId("lobby-create"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("lobby-create")).toBeDisabled();
    finish({ error: "Не удалось сохранить настройки" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сохранить настройки");
    await user.click(screen.getByTestId("lobby-create"));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1]).toEqual(onSubmit.mock.calls[0]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
