import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "../i18n/context.js";
import { cx } from "./cx.js";
import { IconButton } from "./Button.js";
import styles from "./Modal.module.css";

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  testId?: string;
  closeTestId?: string;
  children: ReactNode;
}

/** Native <dialog>: browser-provided focus trap, Esc and inert background. */
export function Modal({ open, title, onClose, footer, size = "md", testId, closeTestId, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      // The dialog would focus its close button first; the first field of the content is the better start.
      dialog.querySelector<HTMLElement>("[autofocus], [data-modal-body] input, [data-modal-body] select, [data-modal-body] textarea")?.focus();
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.root, styles[size])}
      data-testid={testId}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          <IconButton icon={X} label={t("common.close")} variant="ghost" size="sm" data-testid={closeTestId} onClick={onClose} />
        </header>
        <div className={styles.body} data-modal-body="">{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </dialog>
  );
}
