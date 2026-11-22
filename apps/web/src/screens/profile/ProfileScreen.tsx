import type { ReactNode } from "react";
import { Tabs } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import { AwardsPanel } from "./AwardsPanel.js";
import { FriendsPanel } from "./FriendsPanel.js";
import { HistoryPanel } from "./HistoryPanel.js";
import { OverviewPanel } from "./OverviewPanel.js";
import { ProfileSidebar } from "./ProfileSidebar.js";
import { usePeople, useProfileData } from "./useProfileData.js";
import styles from "./ProfileScreen.module.css";

export function ProfileScreen({ token, apiUrl, userId, displayName, appearance }: {
  token?: string; apiUrl?: string; userId?: string; displayName?: string; appearance?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const data = useProfileData(token, apiUrl, userId);
  const people = usePeople(token, apiUrl);
  return (
    <div className={styles.root}>
      <ProfileSidebar name={displayName ?? t("profile.youFallback")} level={data.level} totalXp={data.totalXp} nextLevelXp={data.nextLevelXp} bio={data.bio} avatarUrl={data.avatarUrl} onAvatar={data.changeAvatar} achievements={data.achievements} total={data.totalAchievements} />
      <div className={styles.content}>
        <Tabs
          label={t("profile.sections")}
          tabs={[
            { id: "overview", label: t("profile.overviewTab"), panel: <OverviewPanel data={data} locale={locale} settings={appearance} /> },
            { id: "history", label: t("profile.historyTab"), panel: <HistoryPanel data={data} /> },
            { id: "friends", label: t("profile.friends"), count: data.incoming.length || undefined, panel: <FriendsPanel data={data} people={people} /> },
            { id: "awards", label: t("profile.achievements"), panel: <AwardsPanel items={data.achievements} total={data.totalAchievements} /> },
          ]}
        />
      </div>
    </div>
  );
}
