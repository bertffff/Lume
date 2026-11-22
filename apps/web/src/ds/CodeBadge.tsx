import { Check, Copy } from "lucide-react";
import { formatRoomCode, parseRoomCode } from "@lume/contracts";
import { useState } from "react";
import { useI18n } from "../i18n/context.js";
import { cx } from "./cx.js";
import { Icon } from "./Icon.js";
import styles from "./CodeBadge.module.css";

/** Room invite code: always shown as upper-case 3–3 in the mono face; invalid input renders nothing. */
export function CodeBadge({ code, copyable = false, className }: { code: string; copyable?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const canonical = parseRoomCode(code);
  if (!canonical) return null;
  const shown = formatRoomCode(canonical);
  if (!copyable) return <span className={cx(styles.root, className)}>{shown}</span>;
  const copy = () => {
    void navigator.clipboard?.writeText(canonical).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <button type="button" className={cx(styles.root, styles.button, className)} onClick={copy} aria-label={t("ds.copyCode", { code: shown })}>
      {shown}
      <Icon icon={copied ? Check : Copy} size="sm" />
    </button>
  );
}
