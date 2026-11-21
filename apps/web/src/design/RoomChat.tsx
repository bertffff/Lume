import { emojiCategories } from "@lume/contracts";
import { Paperclip, Send, Smile } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { apiUrl } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { useChatScroll } from "../room/hooks/useChatScroll.js";
import type { RoomActions } from "../room/live.js";
import { EmojiPicker } from "./EmojiPicker.js";
import { initials, personHue } from "./theme.js";

export function RoomChat({ live, recent, onRecent, active, commandLine }: {
  live: RoomActions;
  recent: string[];
  onRecent: (next: string[]) => void;
  active: boolean;
  commandLine: boolean;
}) {
  const { t } = useI18n();
  const { messages } = live.state;
  const chatRef = useRef<HTMLDivElement>(null);
  const emojiButton = useRef<HTMLButtonElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [command, setCommand] = useState("");
  const [uploading, setUploading] = useState(false);
  const [seenId, setSeenId] = useState(() => messages.at(-1)?.id);
  const unreadStart = seenId === undefined ? 0 : messages.findIndex((message) => message.id === seenId) + 1;
  const unread = messages.length - unreadStart;
  const chat = useChatScroll(chatRef, messages.length);

  function jump(unreadOnly: boolean) {
    if (unreadOnly) chatRef.current?.querySelector('[data-unread="true"]')?.scrollIntoView({ block: "center" });
    else chat.jumpToLatest();
    setSeenId(messages.at(-1)?.id);
  }

  async function attachImage(file: File | undefined) {
    if (!file?.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`${apiUrl}/uploads`, {
        method: "POST",
        headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ dataBase64 }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { url?: string };
      if (payload.url) live.sendImage(payload.url, t("chat.photo"));
    } catch {
      // Keep the draft when an upload fails.
    } finally {
      setUploading(false);
    }
  }

  function pickEmoji(emoji: string) {
    setDraft((value) => `${value}${emoji}`);
    void fetch(`${apiUrl}/me/recent-emojis`, {
      method: "POST",
      headers: { authorization: `Bearer ${live.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = (await response.json()) as { recentEmojis?: string[] };
      if (Array.isArray(payload.recentEmojis)) onRecent(payload.recentEmojis);
    }).catch(() => undefined);
  }

  return (
    <>
      {unread > 0 && <button type="button" className="room-chat-jump" data-testid="unread-anchor" onClick={() => jump(true)}>{t("room.newMessagesShort", { count: unread })}</button>}
      <div className="room-chat-log" data-testid="chat-log" role="log" aria-label={t("chat.title")} ref={chatRef} onScroll={chat.onScroll}>
        {messages.length === 0 && <p className="room-empty">{t("room.chatEmpty")}</p>}
        {messages.map((message, index) => {
          const mine = message.userId === live.selfId;
          return (
            <Fragment key={message.id}>
              {index === unreadStart && <span className="room-unread-divider" data-testid="unread-divider">{t("room.unreadTitle")}</span>}
              <div className="room-message" data-mine={mine} data-testid="chat-message" data-unread={index >= unreadStart}>
                {!mine && <span className={`av p-${personHue(message.userId)}`} aria-hidden="true">{initials(message.displayName)}</span>}
                <div>{!mine && <b>{message.displayName}</b>}{message.body}{message.imageUrl && <img className="chat-attach" src={message.imageUrl} alt={t("chat.photo")} loading="lazy" />}</div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {chat.newCount > 0 && <button type="button" className="room-chat-jump" data-testid="chat-new" onClick={() => jump(false)}>{t("chat.new", { count: chat.newCount })}</button>}
      <div className="room-reactions">{Object.values(emojiCategories).flat().slice(0, 5).map((emoji) => <button key={emoji} type="button" onClick={() => live.sendFloat(emoji)} aria-label={t("room.reaction", { emoji })}>{emoji}</button>)}</div>
      {live.typingName && <small className="room-typing">{live.typingName} {t("chat.typing")}</small>}
      {active && emojiOpen && <EmojiPicker recent={recent} anchor={emojiButton.current} onPick={pickEmoji} onClose={() => setEmojiOpen(false)} />}
      <form className="room-composer" onSubmit={(event) => {
        event.preventDefault();
        if (!draft.trim()) return;
        live.sendChat(draft.trim());
        setDraft("");
      }}>
        <button type="button" data-testid="emoji-picker-toggle" ref={emojiButton} aria-expanded={active && emojiOpen} aria-label={t("room.emoji")} onClick={() => setEmojiOpen((value) => !value)}><Smile aria-hidden="true" /></button>
        <label className="room-attach" title={t("chat.attach")}>
          <input type="file" accept="image/*" data-testid="chat-attach" aria-label={t("chat.attach")} disabled={uploading} onChange={(event) => { void attachImage(event.target.files?.[0]); event.target.value = ""; }} />
          <Paperclip aria-hidden="true" />
        </label>
        <input data-testid="chat-input" value={draft} onChange={(event) => { setDraft(event.target.value); live.sendTyping(); }} placeholder={t("chat.placeholder")} aria-label={t("room.message")} />
        <button type="submit" data-testid="chat-send" aria-label={t("chat.send")}><Send aria-hidden="true" /></button>
      </form>
      {commandLine && <form className="room-command" onSubmit={(event) => { event.preventDefault(); if (command.trim()) live.sendChat(command.trim()); setCommand(""); }}>
        <span>ROOM :</span><input aria-label={t("room.message")} value={command} onChange={(event) => setCommand(event.target.value)} />
      </form>}
    </>
  );
}
