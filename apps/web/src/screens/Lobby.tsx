import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n/context.js";

export function Lobby({
  onEnter,
}: {
  onEnter: (input: { title: string; displayName: string }) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [displayName, setDisplayName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onEnter({
      title: title.trim() || t("lobby.kicker"),
      displayName: displayName.trim() || t("voice.you"),
    });
  }

  return (
    <section className="tr-lobby">
      <p className="tr-kicker">{t("lobby.kicker")}</p>
      <h1>{t("lobby.title")}</h1>
      <p className="tr-lead">{t("lobby.body")}</p>
      <form onSubmit={submit}>
        <label>
          {t("lobby.roomTitle")}
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          {t("lobby.displayName")}
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <button type="submit" className="tr-primary">
          {t("lobby.enter")}
        </button>
        <p className="tr-note">{t("lobby.note")}</p>
      </form>
    </section>
  );
}
