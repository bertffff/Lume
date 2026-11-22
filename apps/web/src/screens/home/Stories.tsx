import { Plus } from "lucide-react";
import { Avatar, Icon } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import type { HomeProps } from "./types.js";
import styles from "./Stories.module.css";

/** Friend strip for narrow screens, where the side column is below the feed. */
export function Stories({ friends, onCreate, onJoinFriend, onProfile }: Pick<HomeProps, "friends" | "onJoinFriend"> & { onCreate: () => void; onProfile: () => void }) {
  const { t } = useI18n();
  const ordered = [...friends].sort((a, b) => Number(Boolean(b.roomId)) - Number(Boolean(a.roomId))).slice(0, 8);
  return (
    <div className={styles.row} role="group" aria-label={t("home.stories")}>
      <button type="button" className={styles.item} onClick={onCreate}>
        <span className={styles.add}><Icon icon={Plus} size="md" /></span>
        <span className={styles.name}>{t("home.storyMine")}</span>
      </button>
      {ordered.map((friend) => (
        <button key={friend.id} type="button" className={styles.item} onClick={() => (friend.roomId ? onJoinFriend(friend.roomId) : onProfile())}>
          <Avatar name={friend.displayName} size="lg" presence={friend.roomId ? "online" : "offline"} className={friend.roomId ? styles.live : undefined} />
          <span className={styles.name}>{friend.displayName.split(/\s+/)[0]}</span>
        </button>
      ))}
    </div>
  );
}
