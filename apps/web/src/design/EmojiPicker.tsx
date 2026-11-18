import { emojiKeywords, emojiPickerCategories, emojiPickerCategoryIds, type EmojiPickerCategory } from "@lume/contracts";
import { useState } from "react";

type PickerTab = "recent" | EmojiPickerCategory;

const labels: Record<PickerTab, string> = {
  recent: "Недавние",
  faces: "Лица",
  gestures: "Жесты",
  hearts: "Сердца",
  animals: "Животные",
  food: "Еда",
  symbols: "Символы",
};

export function EmojiPicker({
  recent,
  onPick,
}: {
  recent: readonly string[];
  onPick: (emoji: string) => void;
}) {
  const [tab, setTab] = useState<PickerTab>("recent");
  const [query, setQuery] = useState("");
  const all = Array.from(new Set(Object.values(emojiPickerCategories).flat()));
  const needle = query.trim();
  const lower = needle.toLowerCase();
  const shown = needle
    ? all.filter(
        (emoji) =>
          emoji.includes(needle) ||
          (emojiKeywords[emoji] ?? []).some((keyword) => keyword.toLowerCase().includes(lower)),
      )
    : tab === "recent"
      ? recent
      : emojiPickerCategories[tab];

  return (
    <div className="emoji-picker" data-testid="emoji-picker" role="dialog" aria-label="Эмодзи">
      <div className="emoji-tabs" role="tablist">
        {emojiPickerCategoryIds.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={!needle && tab === id}
            className={!needle && tab === id ? "on" : ""}
            data-testid={`emoji-tab-${id}`}
            onClick={() => {
              setQuery("");
              setTab(id);
            }}
          >
            {labels[id]}
          </button>
        ))}
      </div>
      <input
        data-testid="emoji-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск эмодзи"
        aria-label="Поиск эмодзи"
      />
      <div className="emoji-grid" data-testid="emoji-grid">
        {shown.length === 0 ? <p className="tr-empty">{needle ? "Ничего не найдено" : "Недавних пока нет"}</p> : null}
        {shown.map((emoji) => (
          <button key={emoji} type="button" data-testid="emoji-option" onClick={() => onPick(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
