import { cx } from "../../ds/cx.js";
import { useI18n } from "../../i18n/context.js";
import { heatLevel, weekdayOf } from "./time.js";
import styles from "./SeasonMap.module.css";

const WEEKS = 20;
const levels = [styles.l0, styles.l1, styles.l2, styles.l3, styles.l4] as const;
const offsets = [styles.r0, styles.r1, styles.r2, styles.r3, styles.r4, styles.r5, styles.r6] as const;

/** Last 20 weeks of watch activity. Without any activity it is an invitation, not a grid of empty squares. */
export function SeasonGrid({ title, heat }: { title: string; heat: ReadonlyArray<{ day: string; score: number }> }) {
  const { t } = useI18n();
  const cells = heat.slice(-WEEKS * 7);
  const active = cells.filter((cell) => cell.score > 0).length;
  const caption = t("home.seasonCaption", { active, total: cells.length });
  return (
    <section className={styles.season} aria-label={title}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {active > 0 ? <span className={styles.caption}>{caption}</span> : null}
      </div>
      {active > 0 ? (
        <div className={styles.grid} role="img" aria-label={caption}>
          {cells.map((cell, index) => (
            <i key={cell.day} className={cx(styles.cell, levels[heatLevel(cell.score)], index === 0 && offsets[weekdayOf(cell.day)])} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>{t("home.seasonEmpty")}</p>
      )}
    </section>
  );
}
