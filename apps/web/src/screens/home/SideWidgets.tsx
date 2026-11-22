import { ChevronRight } from "lucide-react";
import { Card, CardHeader, Icon } from "../../ds/index.js";
import { SeasonGrid } from "./SeasonMap.js";
import { useI18n } from "../../i18n/context.js";
import { copy } from "../../design/copy.js";
import type { HomeProps } from "./types.js";
import styles from "./SideWidgets.module.css";

/** Level and season share one card: both answer "how am I doing", and one card keeps the side column short. */
export function ProgressCard({ level, heat, seasonTitle, onOpen }: { level: number; heat: HomeProps["heat"]; seasonTitle: string; onOpen: () => void }) {
  const { t, locale } = useI18n();
  const text = copy(locale);
  return (
    <Card as="section" aria-label={`${text.level} ${level}`} className={styles.progress}>
      <button type="button" className={styles.level} aria-label={`${text.level} ${level}. ${t("home.openProfile")}`} onClick={onOpen}>
        <span className={styles.mark}>{level}</span>
        <span className={styles.levelText}>
          <span className={styles.levelTitle}>{text.level} {level}</span>
          <span className={styles.levelHint}>{t("home.xpHint")}</span>
        </span>
        <Icon icon={ChevronRight} size="md" className={styles.chevron} />
      </button>
      <SeasonGrid title={seasonTitle} heat={heat} />
    </Card>
  );
}

export function RemindersCard({ reminders }: { reminders: HomeProps["reminders"] }) {
  const { t } = useI18n();
  return (
    <Card as="section" aria-label={t("home.reminders")}>
      <CardHeader title={t("home.reminders")} meta={reminders.length} />
      {reminders.length > 0 ? (
        <ul className={styles.list}>
          {reminders.slice(0, 2).map((note) => (
            <li key={note.id} className={styles.note}>
              <span className={styles.noteTitle}>{note.title}</span>
              <span className={styles.noteBody}>{note.body}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{t("home.noReminders")}</p>
      )}
    </Card>
  );
}

/** Honest global numbers: a quiet line next to the greeting, not a block above the actions. */
export function StatsStrip({ stats, ready }: { stats: HomeProps["stats"]; ready: boolean }) {
  const { t } = useI18n();
  const items = [
    ["stats.online", "stat-users-online", stats.usersOnline],
    ["stats.activeRooms", "stat-active-rooms", stats.activeRooms],
    ["stats.videos", "stat-total-videos", stats.totalVideos],
    ["stats.hours", "stat-watch-hours", stats.totalWatchHours],
  ] as const;
  return (
    <section className={styles.stats} data-testid="global-stats" data-ready={ready ? "true" : "false"} aria-label={t("home.statsTitle")}>
      <dl className={styles.statRow}>
        {items.map(([label, id, value]) => (
          <div key={id} className={styles.stat}>
            <dt className={styles.statLabel}>{t(label)}</dt>
            <dd className={styles.statValue} data-testid={id} data-value={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
