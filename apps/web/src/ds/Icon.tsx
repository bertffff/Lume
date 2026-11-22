import type { LucideIcon } from "lucide-react";
import { cx } from "./cx.js";
import styles from "./Icon.module.css";

export type IconSize = "sm" | "md" | "lg";
const pixels: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 };

/** The only way to render an interface icon: lucide, one of three sizes, stroke from the style. */
export function Icon({ icon: Glyph, size = "md", className }: { icon: LucideIcon; size?: IconSize; className?: string }) {
  return <Glyph className={cx(styles.icon, className)} size={pixels[size]} aria-hidden="true" focusable="false" />;
}
