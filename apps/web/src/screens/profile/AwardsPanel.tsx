import { Card } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import type { Achievement } from "./types.js";
import { cx } from "../../ds/cx.js";
import styles from "./panels.module.css";

export function AwardsPanel({ items, total }: { items: readonly Achievement[]; total: number }) {
  const { t } = useI18n();
  const earned = items.filter((item) => item.earned).length;
  return (
    <Card as="section" aria-label={t("profile.achievements")}>
      <h2 className={styles.heading}>{t("profile.achievements")}</h2>
      <ul className={styles.awardsGrid} data-testid="profile-achievements">
        {items.map((item) => (
          <li key={item.key} className={cx(styles.award, item.earned ? styles.awardEarned : styles.awardLocked)} data-testid="profile-achievement" data-key={item.key} data-earned={String(item.earned)}>
            <span className={styles.awardIcon} aria-hidden="true">{item.icon}</span>
            <strong className={styles.awardTitle}>{item.title.startsWith(item.icon) ? item.title.slice(item.icon.length).trim() : item.title}</strong>
            <small className={styles.awardState}>{t(item.earned ? "profile.awardEarned" : "profile.awardLocked")}</small>
          </li>
        ))}
      </ul>
      <p className={styles.caption} data-testid="profile-achievements-count">{t("profile.openCount", { earned, total })}</p>
    </Card>
  );
}
