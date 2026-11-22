import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "../../ds/cx.js";
import { heatLevel, weekdayOf } from "../home/time.js";
import styles from "./SeasonHeatmap.module.css";

export interface SeasonDay { day: string; score: number }

export interface SeasonHeatmapProps {
  title: string;
  days: readonly SeasonDay[];
  locale: string;
  scoreText: (score: number) => string;
  lessLabel: string;
  moreLabel: string;
  emptyText: string;
  summaryText: (activeDays: number) => string;
}

const levels = [styles.l0, styles.l1, styles.l2, styles.l3, styles.l4] as const;
const offsets = [styles.r0, styles.r1, styles.r2, styles.r3, styles.r4, styles.r5, styles.r6] as const;

/**
 * A year of activity as weeks × weekdays. One tab stop; arrows move by day (up/down) or week (left/right);
 * the readout appears on hover or focus and Escape hides it, so the map works with a mouse, a finger and a keyboard.
 */
export function SeasonHeatmap({ title, days, locale, scoreText, lessLabel, moreLabel, emptyText, summaryText }: SeasonHeatmapProps) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [current, setCurrent] = useState(Math.max(0, days.length - 1));
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused;
  const format = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }), [locale]);

  if (days.length === 0 || days.every((entry) => entry.score <= 0)) {
    return <section className={styles.root} aria-label={title}><h2 className={styles.title}>{title}</h2><p className={styles.empty}>{emptyText}</p></section>;
  }

  function move(event: KeyboardEvent, index: number) {
    const target = event.key === "ArrowLeft" ? index - 7 : event.key === "ArrowRight" ? index + 7
      : event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1
      : event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : null;
    if (event.key === "Escape") { setHovered(null); setFocused(null); return; }
    if (target === null) return;
    event.preventDefault();
    const next = Math.min(days.length - 1, Math.max(0, target));
    setCurrent(next);
    refs.current[next]?.focus();
  }

  const entry = active === null ? null : days[active];
  return (
    <section className={styles.root} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.legend} aria-hidden="true">
          <span>{lessLabel}</span>
          {levels.map((level) => <i key={level} className={cx(styles.cell, level)} />)}
          <span>{moreLabel}</span>
        </div>
      </div>
      <ul className={styles.grid} role="list" onMouseLeave={() => setHovered(null)}>
        {days.map(({ day, score }, index) => (
          <li key={day} className={cx(styles.item, index === 0 && offsets[weekdayOf(day)])}>
            <button
              type="button"
              ref={(node) => { refs.current[index] = node; }}
              className={cx(styles.cell, styles.day, levels[heatLevel(score)])}
              tabIndex={index === current ? 0 : -1}
              aria-label={format.format(new Date(`${day}T00:00:00Z`))}
              aria-describedby={active === index ? `${id}-tip` : undefined}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => { setFocused(index); setCurrent(index); setHovered(null); }}
              onBlur={() => setFocused(null)}
              onKeyDown={(event) => move(event, index)}
            />
          </li>
        ))}
      </ul>
      <div className={styles.readout}>
        {entry ? (
          <div id={`${id}-tip`} role="tooltip">
            <time dateTime={entry.day}>{format.format(new Date(`${entry.day}T00:00:00Z`))}</time>
            <span>{scoreText(entry.score)}</span>
          </div>
        ) : <span>{summaryText(days.filter((item) => item.score > 0).length)}</span>}
      </div>
    </section>
  );
}
