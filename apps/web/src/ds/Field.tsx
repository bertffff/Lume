import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { cloneElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx.js";
import { Icon } from "./Icon.js";
import styles from "./Field.module.css";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}

/** Label + control + hint/error, wired with ids so screen readers read all three. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {cloneElement(children, { id, "aria-describedby": note ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {note ? <p id={noteId} className={cx(styles.note, error && styles.error)} role={error ? "alert" : undefined}>{note}</p> : null}
    </div>
  );
}

function Shell({ icon, invalid, trailing, children }: { icon?: LucideIcon; invalid?: boolean; trailing?: ReactNode; children: ReactNode }) {
  return (
    <span className={cx(styles.shell, invalid && styles.invalid)}>
      {icon ? <Icon icon={icon} size="md" className={styles.lead} /> : null}
      {children}
      {trailing}
    </span>
  );
}

export function Input({ icon, className, trailing, ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon; trailing?: ReactNode }) {
  return <Shell icon={icon} invalid={rest["aria-invalid"] === true} trailing={trailing}><input className={cx(styles.control, className)} {...rest} /></Shell>;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell invalid={rest["aria-invalid"] === true} trailing={<Icon icon={ChevronDown} size="sm" className={styles.chevron} />}>
      <select className={cx(styles.control, styles.select, className)} {...rest}>{children}</select>
    </Shell>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Shell invalid={rest["aria-invalid"] === true}><textarea className={cx(styles.control, styles.area, className)} {...rest} /></Shell>;
}
