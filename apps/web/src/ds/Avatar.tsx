import { useState } from "react";
import { cx } from "./cx.js";
import styles from "./Avatar.module.css";

export type AvatarSize = "sm" | "md" | "lg" | "xl";
export type Presence = "online" | "away" | "offline";

/** Stable 1–8 colour slot for a person; the palette is the only place several hues are allowed. */
export function personSlot(seed: string): number {
  let total = 0;
  for (const char of seed) total = (total * 31 + char.charCodeAt(0)) % 8;
  return total + 1;
}

export function initialsOf(name: string): string {
  const [first = "?", second = ""] = name.trim().split(/\s+/).filter(Boolean);
  return `${first[0] ?? "?"}${second[0] ?? ""}`.toUpperCase();
}

export interface AvatarProps {
  name: string;
  /** A photo; the initials stay underneath until it loads and when it fails. */
  src?: string | null;
  size?: AvatarSize;
  presence?: Presence;
  speaking?: boolean;
  className?: string;
}

export function Avatar({ name, src, size = "md", presence, speaking = false, className }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={cx(styles.root, styles[size], styles[`p${personSlot(name)}`], speaking && styles.speaking, className)} role="img" aria-label={name}>
      <span aria-hidden="true">{initialsOf(name)}</span>
      {src && !broken ? <img className={styles.photo} src={src} alt="" loading="lazy" onError={() => setBroken(true)} /> : null}
      {presence ? <span className={cx(styles.dot, styles[presence])} data-presence={presence} /> : null}
    </span>
  );
}

export function AvatarStack({ names, max = 4, size = "sm" }: { names: readonly string[]; max?: number; size?: AvatarSize }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className={styles.stack}>
      {shown.map((name) => <Avatar key={name} name={name} size={size} className={styles.stacked} />)}
      {rest > 0 ? <span className={cx(styles.root, styles[size], styles.more)}>+{rest}</span> : null}
    </span>
  );
}
