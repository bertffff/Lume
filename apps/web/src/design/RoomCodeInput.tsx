import { formatRoomCode, parseRoomCode, ROOM_CODE_ALPHABET } from "@lume/contracts";
import { useId, type ClipboardEvent } from "react";
import { useI18n } from "../i18n/context.js";
import "./room-code-input.css";

// Recognize unfinished entry for display only. Submission always uses the shared parser.
const partialCode = new RegExp(`^(?:[${ROOM_CODE_ALPHABET}]{0,5}|[${ROOM_CODE_ALPHABET}]{3}-[${ROOM_CODE_ALPHABET}]{0,2})$`, "i");

export function RoomCodeInput({ value, onChange, invalid = false, autoFocus = false }: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const canonical = parseRoomCode(value);
  const showRaw = !canonical && !partialCode.test(value);
  const hasError = showRaw || invalid;
  const display = canonical ? formatRoomCode(canonical) : showRaw ? "" : value.toUpperCase();
  const symbols = display.replace("-", "");

  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text/plain");
    if (!/[\r\n]/.test(text)) return;
    // A single-line input deletes pasted line breaks by default. Preserve whitespace
    // as a space so separate fragments cannot become a valid code accidentally.
    event.preventDefault();
    const { selectionStart, selectionEnd } = event.currentTarget;
    onChange(value.slice(0, selectionStart ?? value.length) + text.replace(/\r\n|[\r\n]/g, " ") + value.slice(selectionEnd ?? value.length));
  }

  return (
    <div className="room-code-field">
      <label htmlFor={id}>{t("join.codeLabel")}</label>
      <div className={`room-code-input${showRaw ? " room-code-input-raw" : ""}`}>
        <div className="room-code-cells" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="code-cell">{symbols[index] ?? ""}</span>
          ))}
          <span className="code-separator">-</span>
        </div>
        <input
          id={id}
          className="room-code-native"
          data-testid="lobby-code"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={paste}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={hasError || undefined}
          aria-describedby={`${id}-hint`}
          autoFocus={autoFocus}
        />
      </div>
      <div id={`${id}-hint`} className={hasError ? "room-code-error" : "room-code-hint"} aria-live="polite">
        {t(hasError ? "join.codeInvalid" : "join.codeHint")}
      </div>
    </div>
  );
}
