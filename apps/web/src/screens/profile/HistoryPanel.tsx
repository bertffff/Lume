import { favouriteLine } from "@lume/contracts";
import { Card } from "../../ds/index.js";
import { List, ListRow } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import type { ProfileData } from "./useProfileData.js";
import styles from "./panels.module.css";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function HistoryPanel({ data }: { data: ProfileData }) {
  const { t, locale } = useI18n();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const nameOf = (id: string) => data.friends.find((friend) => friend.userId === id)?.displayName ?? t("profile.unknownFriend");
  return (
    <div className={styles.stack}>
      <Card as="section" aria-label={t("profile.watchHistory")}>
        <h2 className={styles.heading}>{t("profile.watchHistory")}</h2>
        {data.history.length === 0 ? <p className={styles.muted} data-testid="profile-history">{t("profile.nothingYet")}</p> : (
          <div data-testid="profile-history">
            <List label={t("profile.watchHistory")}>
              {data.history.map((item) => (
                <ListRow
                  key={item.url}
                  attrs={{ "data-testid": "profile-history-item", "data-url": item.url, "data-watch-count": item.watchCount }}
                  title={item.title || item.url}
                  subtitle={`${hostOf(item.url)} · ${date.format(new Date(item.lastWatchedAt))}`}
                  trailing={<span className={styles.rowValue}>×{item.watchCount}</span>}
                />
              ))}
            </List>
          </div>
        )}
      </Card>
      <Card as="section" aria-label={t("profile.favourites")}>
        <h2 className={styles.heading}>{t("profile.favourites")}</h2>
        <div data-testid="profile-favourites">
          {data.favourites.length === 0 ? <p className={styles.muted}>{t("profile.nothingYet")}</p> : (
            <List label={t("profile.favourites")}>
              {data.favourites.map((item) => (
                <ListRow key={item.url} attrs={{ "data-testid": "profile-favourite", "data-url": item.url, "data-watch-count": item.watchCount }} title={favouriteLine(item.title, item.watchCount)} />
              ))}
            </List>
          )}
        </div>
      </Card>
      <div className={styles.pair}>
        <Card as="section" aria-label={t("profile.platforms")}>
          <h2 className={styles.heading}>{t("profile.platforms")}</h2>
          {data.platforms.length === 0 ? <p className={styles.muted}>{t("profile.nothingYet")}</p> : (
            <List label={t("profile.platforms")}>{data.platforms.map((item) => <ListRow key={item.source} title={item.source} trailing={<span className={styles.rowValue}>{item.count}</span>} />)}</List>
          )}
        </Card>
        <Card as="section" aria-label={t("profile.sessionsWithFriends")}>
          <h2 className={styles.heading}>{t("profile.sessionsWithFriends")}</h2>
          {data.topFriends.length === 0 ? <p className={styles.muted}>{t("profile.nothingYet")}</p> : (
            <List label={t("profile.sessionsWithFriends")}>{data.topFriends.map((item) => <ListRow key={item.partnerId} title={nameOf(item.partnerId)} trailing={<span className={styles.rowValue}>{t("profile.secondsShort", { seconds: item.seconds })}</span>} />)}</List>
          )}
        </Card>
      </div>
    </div>
  );
}
