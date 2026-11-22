import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx.js";
import { Icon } from "./Icon.js";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = "secondary", size = "md", icon, loading = false, block = false, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.root, styles[variant], styles[size], block && styles.block, className)}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon ? <Icon icon={icon} size={size === "lg" ? "md" : "sm"} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pressed?: boolean;
}

export function IconButton({ icon, label, variant = "secondary", size = "md", pressed, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} className={cx(styles.root, styles.square, styles[variant], styles[size], className)} aria-label={label} title={label} aria-pressed={pressed} {...rest}>
      <Icon icon={icon} size={size === "lg" ? "lg" : "md"} />
    </button>
  );
}
