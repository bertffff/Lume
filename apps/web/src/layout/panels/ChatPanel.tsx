import { extractTimecodeSeconds, imageKind, mentionsUser, slowRemainingMs } from "@lume/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { apiUrl } from "../../api/client.js";
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
  const [pin, setPin] = useState<string | null>(null);
  const [waitMs, setWaitMs] = useState(0);

  const roomId = live?.state.room.id;
  const token = live?.accessToken;
  const canControl = live?.canControl ?? false;
  useEffect(() => {
    if (!roomId || !token) return;
    void fetch(`${apiUrl}/rooms/${roomId}/pin`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { message?: { body?: string } | null }) => setPin(payload.message?.body ?? null))
      .catch(() => setPin(null));
    void fetch(`${apiUrl}/rooms/${roomId}/pace`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { slowModeSeconds?: number; lastMessageAt?: string | null }) => {
        const last = payload.lastMessageAt ? Date.parse(payload.lastMessageAt) : null;
        setWaitMs(slowRemainingMs(last, Date.now(), payload.slowModeSeconds ?? 0, canControl));
      })
      .catch(() => setWaitMs(0));
  }, [canControl, roomId, token]);

  useEffect(() => {
    if (waitMs <= 0) return;
    const timer = window.setInterval(() => setWaitMs((value) => Math.max(0, value - 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [waitMs]);

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
      {pin ? <p className="tr-banner" data-testid="pinned-message">{t("chat.pinned")} {pin}</p> : null}
      {waitMs > 0 ? <p className="tr-note" data-testid="slow-countdown">{t("chat.slow")} {Math.ceil(waitMs / 1000)}</p> : null}
      <div className="tr-chat-log" data-testid="chat-log">
        {messages.length === 0 ? <p className="tr-empty">{t("chat.empty")}</p> : null}
        {live?.typingName ? <p className="tr-note">{live.typingName} {t("chat.typing")}</p> : null}
        {messages.map((message) => {
          const timecode = extractTimecodeSeconds(message.body);
          const mentioned = mentionsUser(message.body, null, live?.state.members.find((member) => member.userId === live.selfId)?.displayName ?? "");
          return (
          <p key={message.id} className={mentioned ? "is-mentioned" : undefined}>
            <strong>{message.displayName}</strong>
            {message.body}
            <span className="tr-inline-actions">
              <button type="button" className="tr-text-button" onClick={() => setReplyToId(message.id)}>
                {t("chat.reply")}
              </button>
              {timecode !== null ? (
                <button type="button" className="tr-text-button" onClick={() => live?.setPlayback("seek", timecode * 1000)}>
                  {t("chat.timecode")}
                </button>
              ) : null}
              <button
                type="button"
                className="tr-text-button"
                onClick={() => {
                  void fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:3001"}/rooms/${live?.state.room.id}/pin`, {
                    method: "POST",
                    headers: { "content-type": "application/json", authorization: `Bearer ${live?.accessToken ?? ""}` },
                    body: JSON.stringify({ messageId: message.id }),
                  });
                }}
              >
                {t("chat.pin")}
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
        );
        })}
      </div>
      <form className="tr-composer" onSubmit={submit}>
        {replyToId ? (
          <button type="button" className="tr-text-button" onClick={() => setReplyToId(null)}>
            {t("chat.cancelReply")} {messages.find((message) => message.id === replyToId)?.body ?? ""}
          </button>
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          aria-label={t("chat.photo")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file || !live) return;
            void file.arrayBuffer().then(async (buffer) => {
              const bytes = new Uint8Array(buffer);
              if (!imageKind(bytes) || bytes.byteLength > 10 * 1024 * 1024) return;
              const uploaded = await fetch(`${apiUrl}/uploads`, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${live.accessToken}` },
                body: JSON.stringify({ dataBase64: btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")) }),
              });
              const payload = (await uploaded.json()) as { url?: string };
              if (!payload.url) return;
              await fetch(`${apiUrl}/rooms/${live.state.room.id}/images`, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${live.accessToken}` },
                body: JSON.stringify({ imageUrl: payload.url, replyToId }),
              });
            });
          }}
        />
        <label className="tr-sr" htmlFor="room-chat">
          {t("chat.placeholder")}
        </label>
        <input
          id="room-chat"
          data-testid="chat-input"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            live?.sendTyping();
          }}
          placeholder={t("chat.placeholder")}
        />
        <button type="submit" data-testid="chat-send">
          {t("chat.send")}
        </button>
      </form>
    </section>
  );
}
