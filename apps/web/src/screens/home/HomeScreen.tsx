import { ContinueTile } from "./ContinueTile.js";
import { CreateTile } from "./CreateTile.js";
import { FriendsCard } from "./FriendsCard.js";
import { GuestTile } from "./GuestTile.js";
import { JoinTile } from "./JoinTile.js";
import { ProgressCard, RemindersCard, StatsStrip } from "./SideWidgets.js";
import { Stories } from "./Stories.js";
import { useI18n } from "../../i18n/context.js";
import { copy } from "../../design/copy.js";
import type { HomeProps } from "./types.js";
import styles from "./HomeScreen.module.css";

/** Home: one main action, three entry tiles, the open-room feed, and a side column that never outgrows the viewport. */
export function HomeScreen(props: HomeProps) {
  const { t, locale } = useI18n();
  const text = copy(locale);
  const signedIn = props.displayName !== null;
  const firstName = props.displayName?.split(/\s+/)[0] ?? "";
  const watching = props.friends.filter((friend) => friend.roomId).length;
  const subtitle = !signedIn
    ? t("home.guestLead")
    : watching > 0
      ? t("home.friendsWatchingCount", { count: watching })
      : t("home.subtitleSigned");

  return (
    <div className={styles.page} data-testid="home-screen">
      <div className={styles.main}>
        <div className={styles.top}>
          <header className={styles.greeting}>
            <h1 className={styles.title}>{signedIn ? `${text.evening}, ${firstName}` : text.evening}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </header>
          <div className={styles.stats}><StatsStrip stats={props.stats} ready={props.statsReady} /></div>
        </div>
        {signedIn ? (
          <Stories friends={props.friends} onCreate={props.onCreate} onJoinFriend={props.onJoinFriend} onProfile={() => props.onGo("/profile")} />
        ) : null}
        <div className={signedIn ? styles.tiles : styles.tilesGuest}>
          {signedIn ? (
            <>
              <ContinueTile resume={props.resume} busy={props.resuming} onResume={props.onResume} onFind={() => props.onGo("/search")} />
              <CreateTile onCreate={props.onCreate} />
            </>
          ) : (
            <GuestTile guest={props.guest} onCreate={props.onCreate} />
          )}
          <JoinTile join={props.join} />
        </div>
        {props.catalog}
      </div>
      <aside className={styles.side} aria-label={t("home.friendsOnline")}>
        <FriendsCard
          signedIn={signedIn}
          friends={props.friends}
          people={props.people}
          onSearchPeople={props.onSearchPeople}
          onJoinFriend={props.onJoinFriend}
          onInviteFriend={props.onInviteFriend}
          onRemoveFriend={props.onRemoveFriend}
          onAll={() => props.onGo("/profile")}
        />
        {signedIn ? <RemindersCard reminders={props.reminders} /> : null}
        {signedIn ? <ProgressCard level={props.level} heat={props.heat} seasonTitle={text.season} onOpen={() => props.onGo("/profile")} /> : null}
      </aside>
    </div>
  );
}
