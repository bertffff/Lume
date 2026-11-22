import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { mediaSrc } from "../../api/client.js";
import { Avatar, Badge, Button, Card } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import type { Achievement } from "./types.js";
import styles from "./ProfileSidebar.module.css";

export function ProfileSidebar({ name, level, totalXp, nextLevelXp, bio, achievements, total, avatarUrl, onAvatar }: {
  name: string; level: number; totalXp: number; nextLevelXp: number; bio: string; achievements: readonly Achievement[]; total: number;
  avatarUrl: string | null; onAvatar: (file: File | null) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function change(file: File | null) {
    setBusy(true);
    setFailed(!(await onAvatar(file)));
    setBusy(false);
  }
  const earned = achievements.filter((item) => item.earned).length;
  return (
    <aside className={styles.root}>
      <Card as="section" pad="lg" className={styles.card} aria-label={name}>
        <Avatar name={name} size="xl" src={mediaSrc(avatarUrl)} />
        <div className={styles.photoActions}>
          <input ref={picker} type="file" accept="image/*" hidden data-testid="avatar-input" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void change(file); }} />
          <Button size="sm" icon={Camera} loading={busy} data-testid="avatar-change" onClick={() => picker.current?.click()}>{t("profile.changePhoto")}</Button>
          {avatarUrl ? <Button size="sm" variant="ghost" disabled={busy} data-testid="avatar-remove" onClick={() => void change(null)}>{t("profile.removePhoto")}</Button> : null}
        </div>
        {failed ? <p className={styles.next} role="status">{t("profile.photoFailed")}</p> : null}
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.line}><span data-testid="profile-level">{t("profile.level", { level })}</span> · <span data-testid="profile-xp">{totalXp} XP</span></p>
        <p className={styles.next} data-testid="profile-next-level">{t("profile.nextLevelIn", { xp: Math.max(0, nextLevelXp - totalXp) })}</p>
        {bio ? <p className={styles.bio}>{bio}</p> : null}
      </Card>
      <Card as="section" aria-label={t("profile.achievements")}>
        <div className={styles.awardsHead}>
          <h2 className={styles.awardsTitle}>{t("profile.achievements")}</h2>
          <Badge tone={earned > 0 ? "accent" : "neutral"}>{t("profile.earnedOf", { earned, total })}</Badge>
        </div>
        <ul className={styles.awards}>
          {achievements.slice(0, 4).map((item) => (
            <li key={item.key} className={item.earned ? styles.got : styles.locked} data-earned={String(item.earned)} title={item.title}>
              <span aria-hidden="true" className={styles.icon}>{item.icon}</span>
              <span className={styles.awardName}>{item.title.startsWith(item.icon) ? item.title.slice(item.icon.length).trim() : item.title}</span>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}
