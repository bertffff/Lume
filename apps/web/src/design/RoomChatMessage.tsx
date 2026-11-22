import type { ChatMessage } from "@lume/contracts";
import { CornerUpLeft } from "lucide-react";
import { mediaSrc } from "../api/client.js";
import { Avatar, Icon } from "../ds/index.js";
import { cx } from "../ds/cx.js";
import { useI18n } from "../i18n/context.js";
import styles from "./RoomChat.module.css";

const quick = ["👍", "❤️", "😂"] as const;

function grouped(reactions: ChatMessage["reactions"], selfId: string) {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const { emoji, userId } of reactions) {
    const entry = byEmoji.get(emoji) ?? { count: 0, mine: false };
    byEmoji.set(emoji, { count: entry.count + 1, mine: entry.mine || userId === selfId });
  }
  return [...byEmoji.entries()];
}

/** One chat line: bubble, an optional quote of the message it answers, reaction chips, and hover/focus actions. */
export function RoomChatMessage({ message, quoted, selfId, unread, onReact, onReply }: {
  message: ChatMessage;
  quoted: ChatMessage | null;
  selfId: string;
  unread: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
}) {
  const { t } = useI18n();
  const mine = message.userId === selfId;
  const chips = grouped(message.reactions, selfId);
  return (
    <div className={cx(styles.message, mine && styles.mine)} data-mine={mine} data-testid="chat-message" data-unread={unread}>
      {!mine && <Avatar name={message.displayName} size="sm" />}
      <div className={styles.stack}>
        <div className={styles.bubble}>
          {!mine && <b className={styles.author}>{message.displayName}</b>}
          {quoted ? <blockquote className={styles.quote} data-testid="chat-quote"><b>{quoted.displayName}</b> {quoted.body}</blockquote> : null}
          {message.body}
          {message.imageUrl && <img className={cx(styles.photo, "chat-attach")} src={mediaSrc(message.imageUrl)} alt={t("chat.photo")} loading="lazy" />}
        </div>
        {chips.length > 0 ? (
          <div className={styles.chips}>
            {chips.map(([emoji, { count, mine: reacted }]) => (
              <button key={emoji} type="button" className={cx(styles.chip, reacted && styles.chipOn)} aria-pressed={reacted} data-testid="chat-reaction" onClick={() => onReact(message.id, emoji)}>
                {emoji} <small>{count}</small>
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.tools}>
          {quick.map((emoji) => (
            <button key={emoji} type="button" className={styles.tool} aria-label={t("room.reaction", { emoji })} data-testid="chat-react" onClick={() => onReact(message.id, emoji)}>{emoji}</button>
          ))}
          <button type="button" className={styles.tool} aria-label={t("chat.reply")} data-testid="chat-reply" onClick={() => onReply(message)}><Icon icon={CornerUpLeft} size="sm" /></button>
        </div>
      </div>
    </div>
  );
}
