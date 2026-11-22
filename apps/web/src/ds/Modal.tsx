import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/context.js";
import { cx } from "./cx.js";
import { IconButton } from "./Button.js";
import styles from "./Modal.module.css";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

/** Native <dialog>: browser-provided focus trap, Esc and inert background. */
export function Modal({ open, title, onClose, footer, size = "md", children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.root, styles[size])}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <IconButton icon={X} label={t("common.close")} variant="ghost" size="sm" onClick={onClose} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </dialog>
  );
}
