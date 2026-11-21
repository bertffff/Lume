import {
  emojiKeywords,
  emojiPickerCategories,
  emojiPickerCategoryIds,
  type EmojiPickerCategory,
} from "@lume/contracts";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/context.js";
import type { MessageKey } from "../i18n/ru.js";

type PickerTab = "recent" | EmojiPickerCategory;

const categoryKeys: Record<PickerTab, MessageKey> = {
  recent: "emoji.category.recent",
  faces: "emoji.category.faces",
  gestures: "emoji.category.gestures",
  hearts: "emoji.category.hearts",
  animals: "emoji.category.animals",
  food: "emoji.category.food",
  symbols: "emoji.category.symbols",
};

export function EmojiPicker({
  recent,
  anchor,
  onPick,
  onClose,
}: {
  recent: readonly string[];
  anchor: HTMLElement | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<PickerTab>("recent");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const update = () => {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(340, Math.max(240, window.innerWidth - 16));
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
      const below = rect.bottom + 8;
      const spaceBelow = window.innerHeight - below - 8;
      const spaceAbove = rect.top - 8;
      const maximum = Math.min(340, Math.max(180, window.innerWidth < 480 ? window.innerHeight * 0.5 : 320));
      const placeBelow = spaceBelow >= Math.min(maximum, 220) || spaceBelow >= spaceAbove;
      const height = placeBelow ? Math.min(maximum, Math.max(160, spaceBelow)) : Math.min(maximum, Math.max(160, spaceAbove));
      const top = placeBelow ? below : Math.max(8, rect.top - height - 8);
      setPosition({ left, top, width, maxHeight: height });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });
    return () => {
      anchor?.focus?.({ preventScroll: true });
    };
  }, [anchor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [anchor, onClose]);

  const panel = (
    <div
      ref={panelRef}
      className="emoji-picker"
      data-testid="emoji-picker"
      role="dialog"
      aria-modal="false"
      aria-label={t("emoji.title")}
      style={
        position
          ? { position: "fixed", left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }
          : { visibility: "hidden" }
      }
    >
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
            {t(categoryKeys[id])}
          </button>
        ))}
      </div>
      <input
        ref={searchRef}
        data-testid="emoji-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("emoji.search")}
        aria-label={t("emoji.search")}
      />
      <div className="emoji-grid" data-testid="emoji-grid">
        {shown.length === 0 ? (
          <p className="empty-note">{needle ? t("emoji.none") : t("emoji.noRecent")}</p>
        ) : null}
        {shown.map((emoji) => (
          <button
            key={emoji}
            type="button"
            data-testid="emoji-option"
            aria-label={emojiKeywords[emoji]?.[0] ?? emoji}
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );

  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
}
