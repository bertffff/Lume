import { formatRoomCode, parseRoomCode, ROOM_CODE_ALPHABET } from "@lume/contracts";
import { useId, type ClipboardEvent } from "react";
import { useI18n } from "../i18n/context.js";
import { cx } from "../ds/cx.js";
import styles from "./RoomCodeInput.module.css";

// Recognize unfinished entry for display only. Submission always uses the shared parser.
const partialCode = new RegExp(`^(?:[${ROOM_CODE_ALPHABET}]{0,5}|[${ROOM_CODE_ALPHABET}]{3}-[${ROOM_CODE_ALPHABET}]{0,2})$`, "i");

/** One real input; six decorative cells show it as 3–3. Pasted grouped codes stay editable. */
export function RoomCodeInput({ value, onChange, invalid = false, autoFocus = false, hideLabel = false }: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  hideLabel?: boolean;
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
    <div className={styles.field}>
      <label htmlFor={id} className={cx(styles.label, hideLabel && styles.visuallyHidden)}>{t("join.codeLabel")}</label>
      <div className={cx(styles.control, hasError && styles.invalid, showRaw && styles.raw)} data-raw={showRaw || undefined}>
        <div className={styles.cells} data-code-cells="" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className={cx(styles.cell, index === symbols.length && styles.current)} data-code-cell="">{symbols[index] ?? ""}</span>
          ))}
          <span className={styles.separator} data-code-separator="">-</span>
        </div>
        <input
          id={id}
          className={styles.native}
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
      <p id={`${id}-hint`} className={cx(styles.hint, hasError && styles.error)} aria-live="polite">
        {t(hasError ? "join.codeInvalid" : "join.codeHint")}
      </p>
    </div>
  );
}
