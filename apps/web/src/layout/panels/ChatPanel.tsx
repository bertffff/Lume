import { useState, type FormEvent } from "react";
import { useI18n } from "../../i18n/context.js";
import { useRoomActions } from "../../room/live.js";

const reactions = ["👍", "🔥", "😂"];

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
  const live = useRoomActions();
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);

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
    if (!body || !live) {
      return;
    }
    live.sendChat(body, replyToId);
    setDraft("");
    setReplyToId(null);
  }

  const messages = live?.state.messages ?? [];

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
      <div className="tr-chat-log" data-testid="chat-log">
        {messages.length === 0 ? <p className="tr-empty">{t("chat.empty")}</p> : null}
        {messages.map((message) => (
          <p key={message.id}>
            <strong>{message.displayName}</strong>
            {message.body}
            <span className="tr-inline-actions">
              <button type="button" className="tr-text-button" onClick={() => setReplyToId(message.id)}>
                {t("chat.reply")}
              </button>
              {reactions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="tr-text-button"
                  onClick={() => live?.react(message.id, emoji)}
                >
                  {emoji}
                  {message.reactions.filter((reaction) => reaction.emoji === emoji).length || ""}
                </button>
              ))}
            </span>
          </p>
        ))}
      </div>
      <form className="tr-composer" onSubmit={submit}>
        {replyToId ? (
          <button type="button" className="tr-text-button" onClick={() => setReplyToId(null)}>
            {t("chat.cancelReply")}
          </button>
        ) : null}
        <label className="tr-sr" htmlFor="room-chat">
          {t("chat.placeholder")}
        </label>
        <input
          id="room-chat"
          data-testid="chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("chat.placeholder")}
        />
        <button type="submit" data-testid="chat-send">
          {t("chat.send")}
        </button>
      </form>
    </section>
  );
}
