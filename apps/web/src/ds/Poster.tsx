import { DoorOpen, Film, Music2, Video, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "./cx.js";
import { Icon } from "./Icon.js";
import styles from "./Poster.module.css";

export type PosterCategory = "film" | "music" | "vlog" | "other";
const glyphs: Record<PosterCategory, LucideIcon> = { film: Film, music: Music2, vlog: Video, other: DoorOpen };

export interface PosterProps {
  /** Thumbnail from trusted metadata. Anything that is not http(s) is ignored. */
  src?: string | null;
  category: PosterCategory;
  /** Overlay content: duration, live badge, progress. */
  children?: ReactNode;
  ratio?: "wide" | "square";
  className?: string;
}

/** Media preview. Without a usable thumbnail it draws a category gradient — never a fake frame. */
export function Poster({ src, category, children, ratio = "wide", className }: PosterProps) {
  const [failed, setFailed] = useState(false);
  const usable = src && /^https?:\/\//i.test(src) && !failed;
  return (
    <div className={cx(styles.root, styles[category], styles[ratio], className)}>
      {usable ? <img className={styles.image} src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className={styles.glyph}><Icon icon={glyphs[category]} size="lg" /></span>}
      {children ? <div className={styles.overlay}>{children}</div> : null}
    </div>
  );
}
