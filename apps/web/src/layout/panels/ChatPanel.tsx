import { useState, type FormEvent } from "react";
import { useI18n } from "../../i18n/context.js";
import type { MessageKey } from "../../i18n/ru.js";

export function ChatPanel({
  collapsed,
  collapsible,
  onToggle,
}: {
  collapsed: boolean;
  collapsible: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<string[]>([]);

  if (collapsed) {
    return (
      <button type="button" className="tr-rail" onClick={onToggle}>
        {t("chat.title")}
      </button>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      return;
    }
    setExtra((messages) => [...messages, body].slice(-30));
    setDraft("");
  }

  const samples: Array<{ author: MessageKey; body: MessageKey }> = [
    { author: "chat.sampleAuthor1", body: "chat.sample1" },
    { author: "chat.sampleAuthor2", body: "chat.sample2" },
  ];

  return (
    <section className="tr-panel" aria-label={t("chat.title")}>
      <header className="tr-panel-bar">
        <span>{t("chat.title")}</span>
        {collapsible ? (
          <button type="button" className="tr-text-button" onClick={onToggle}>
            {t("layout.collapse")}
          </button>
        ) : null}
      </header>
      <div className="tr-chat-log">
        {samples.map((sample) => (
          <p key={sample.body}>
            <strong>{t(sample.author)}</strong>
            {t(sample.body)}
          </p>
        ))}
        {extra.map((body, index) => (
          <p key={`${index}-${body}`}>
            <strong>{t("voice.you")}</strong>
            {body}
          </p>
        ))}
      </div>
      <form className="tr-composer" onSubmit={submit}>
        <label className="tr-sr" htmlFor="room-chat">
          {t("chat.placeholder")}
        </label>
        <input
          id="room-chat"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("chat.placeholder")}
        />
        <button type="submit">{t("chat.send")}</button>
      </form>
    </section>
  );
}
