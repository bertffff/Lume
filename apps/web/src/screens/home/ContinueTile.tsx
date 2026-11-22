import { Clapperboard } from "lucide-react";
import { Button, Icon, Poster, Progress } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import { copy } from "../../design/copy.js";
import { formatClock } from "./time.js";
import type { HomeResume } from "./types.js";
import styles from "./ContinueTile.module.css";

export interface ContinueTileProps {
  resume: HomeResume | null;
  busy: boolean;
  onResume: () => void;
  onFind: () => void;
}

/** Continue where you stopped. Progress is drawn only when both position and length are known. */
export function ContinueTile({ resume, busy, onResume, onFind }: ContinueTileProps) {
  const { t, locale } = useI18n();
  const text = copy(locale);

  if (!resume) {
    return (
      <section className={styles.empty} data-testid="home-resume">
        <span className={styles.glyph}><Icon icon={Clapperboard} size="lg" /></span>
        <h2 className={styles.emptyTitle}>{text.empty}</h2>
        <p className={styles.emptyBody}>{t("room.resumeEmptyHint")}</p>
        <Button size="sm" onClick={onFind}>{t("home.findVideo")}</Button>
      </section>
    );
  }

  const known = resume.positionMs !== null && resume.durationMs !== null && resume.durationMs > 0;
  const ratio = known ? Math.min(1, (resume.positionMs ?? 0) / (resume.durationMs ?? 1)) : null;
  return (
    <button type="button" className={styles.tile} data-testid="home-resume" disabled={busy} onClick={onResume}>
      <Poster src={resume.posterUrl} category="film" className={styles.poster}>
        <span className={styles.content}>
          <span className={styles.label}>{text.resume}</span>
          <span className={styles.title}>{resume.title}</span>
          {known ? (
            <span className={styles.progress}>
              <Progress value={ratio} label={t("resume.progress")} />
              <span className={styles.time}>{t("home.resumeProgress", { position: formatClock(resume.positionMs ?? 0), duration: formatClock(resume.durationMs ?? 0) })}</span>
            </span>
          ) : (
            <span className={styles.time}>{t("room.resumeHint")}</span>
          )}
        </span>
      </Poster>
    </button>
  );
}
