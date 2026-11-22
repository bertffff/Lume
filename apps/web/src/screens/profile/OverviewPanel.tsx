import { useSyncExternalStore } from "react";
import { Avatar, Card } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import { formatDuration } from "./format.js";
import { SeasonHeatmap } from "./SeasonHeatmap.js";
import type { ProfileData } from "./useProfileData.js";
import type { LeaderboardRow } from "./types.js";
import styles from "./panels.module.css";

const narrow = "(max-width: 600px)";
const subscribeNarrow = (notify: () => void) => {
  const query = window.matchMedia(narrow);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

function Board({ id, title, rows, format }: { id: string; title: string; rows: readonly LeaderboardRow[]; format: (value: number) => string }) {
  const { t } = useI18n();
  return (
    <div className={styles.board} data-testid={`profile-leaderboard-${id}`}>
      <h3 className={styles.boardTitle}>{title}</h3>
      {rows.length === 0 ? <p className={styles.muted}>{t("profile.nothingYet")}</p> : rows.slice(0, 5).map((row, index) => (
        <div key={row.userId} className={styles.row} data-testid={`leaderboard-${id}-row`} data-user-id={row.userId} data-value={row.value}>
          <span className={styles.rank}>{index + 1}</span>
          <Avatar name={row.displayName} size="sm" />
          <span className={styles.rowName}>{row.displayName}</span>
          <span className={styles.rowValue}>{format(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function OverviewPanel({ data, locale, settings }: { data: ProfileData; locale: string; settings: React.ReactNode }) {
  const { t } = useI18n();
  const phone = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(narrow).matches, () => false);
  const { engagement } = data;
  const kpis = [
    { label: t("profile.watchSeconds"), id: "engagement-watch", attr: "data-seconds", raw: engagement?.watchSeconds ?? 0, text: engagement ? formatDuration(engagement.watchSeconds, t) : "—" },
    { label: t("profile.voiceSeconds"), id: "engagement-voice", attr: "data-seconds", raw: engagement?.voiceSeconds ?? 0, text: engagement ? formatDuration(engagement.voiceSeconds, t) : "—" },
    { label: t("profile.messages"), id: "engagement-messages", attr: "data-count", raw: engagement?.messages ?? 0, text: engagement ? String(engagement.messages) : "—" },
    { label: t("profile.reactions"), id: "engagement-reactions", attr: "data-count", raw: engagement?.reactions ?? 0, text: engagement ? String(engagement.reactions) : "—" },
  ];
  return (
    <div className={styles.stack}>
      <Card as="section" data-testid="profile-engagement" aria-label={t("profile.engagement")}>
        <dl className={styles.kpis}>
          {kpis.map((item) => (
            <div key={item.id} className={styles.kpi}>
              <dt className={styles.kpiLabel}>{item.label}</dt>
              <dd className={styles.kpiValue} data-testid={item.id} {...{ [item.attr]: item.raw }}>{item.text}</dd>
            </div>
          ))}
        </dl>
        {engagement ? <p className={styles.caption} data-testid="engagement-total" data-seconds={engagement.totalSeconds}>{t("profile.totalActions", { time: formatDuration(engagement.totalSeconds, t), count: engagement.activity })}</p> : null}
      </Card>
      {data.hostStats ? (
        <Card as="section" aria-label={t("profile.hostTitle")} data-testid="host-stats">
          <h2 className={styles.heading}>{t("profile.hostTitle")}</h2>
          <dl className={styles.kpis}>
            <div className={styles.kpi}><dt className={styles.kpiLabel}>{t("profile.hostRooms")}</dt><dd className={styles.kpiValue}>{data.hostStats.roomsHosted}</dd></div>
            <div className={styles.kpi}><dt className={styles.kpiLabel}>{t("profile.hostViewers")}</dt><dd className={styles.kpiValue}>{data.hostStats.uniqueViewers}</dd></div>
            <div className={styles.kpi}><dt className={styles.kpiLabel}>{t("profile.hostVideos")}</dt><dd className={styles.kpiValue}>{data.hostStats.videosPlayed}</dd></div>
          </dl>
          {data.hostStats.topVideos.length > 0 ? (
            <>
              <h3 className={styles.boardTitle}>{t("profile.hostTop")}</h3>
              <ol className={styles.plain}>{data.hostStats.topVideos.map((video) => <li key={video.title}>{video.title} · ×{video.count}</li>)}</ol>
            </>
          ) : null}
        </Card>
      ) : null}
      <Card as="section" pad="lg">
        <SeasonHeatmap
          title={t("profile.season")} days={data.heat.slice(phone ? -154 : -371)} locale={locale}
          scoreText={(score) => (score > 0 ? t("profile.seasonWatched", { time: formatDuration(score, t) }) : t("profile.seasonNone"))}
          lessLabel={t("profile.less")} moreLabel={t("profile.more")} emptyText={t("gruvbox.seasonEmpty")} summaryText={(count) => t("profile.activeDays", { count })}
        />
      </Card>
      <Card as="section" aria-label={t("profile.board")} data-testid="leaderboards">
        <h2 className={styles.heading}>{t("profile.board")}</h2>
        <div className={styles.boards}>
          <Board id="messages" title={t("profile.boardMessages")} rows={data.boards.messages} format={(value) => String(value)} />
          <Board id="reactions" title={t("profile.boardReactions")} rows={data.boards.reactions} format={(value) => String(value)} />
          <Board id="voice" title={t("profile.boardVoice")} rows={data.boards.voice} format={(value) => formatDuration(value, t)} />
        </div>
      </Card>
      {settings ? <Card as="section" pad="lg">{settings}</Card> : null}
    </div>
  );
}
