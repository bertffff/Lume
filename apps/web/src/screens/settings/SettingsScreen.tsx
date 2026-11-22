import { Download, Link2, Trash2, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Card, Input } from "../../ds/index.js";
import { AppearanceControls } from "../../design/AppearanceControls.js";
import type { ModeId, StyleId } from "../../design/theme.js";
import { useI18n } from "../../i18n/context.js";
import { Row } from "./Row.js";
import { useSettingsData } from "./useSettingsData.js";
import styles from "./SettingsScreen.module.css";

export interface SettingsScreenProps {
  style: StyleId;
  mode: ModeId;
  onStyle: (style: StyleId) => void;
  onMode: (mode: ModeId) => void;
  token?: string;
  apiUrl?: string;
  blocked?: Array<{ id: string; displayName: string }>;
  onUnblock?: (id: string) => void;
  globalBans?: Array<{ id: string; userId: string; displayName: string; reason: string | null }>;
  onRemoveGlobalBan?: (userId: string) => void;
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <Card as="section" pad="lg" id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <header className={styles.head}>
        <h2 id={`${id}-title`} className={styles.title}>{title}</h2>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </header>
      {children ? <div className={styles.rows}>{children}</div> : null}
    </Card>
  );
}

function Check({ testId, checked, onChange, label }: { testId?: string; checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <input className={styles.check} data-testid={testId} type="checkbox" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} />;
}

export function SettingsScreen({ style, mode, onStyle, onMode, token, apiUrl, blocked = [], onUnblock, globalBans = [], onRemoveGlobalBan }: SettingsScreenProps) {
  const { t } = useI18n();
  const data = useSettingsData(token, apiUrl, t("settings.linkedNone"), t("settings.linkedNo"));
  const [telegramId, setTelegramId] = useState("");
  const [exportState, setExportState] = useState<"idle" | "busy" | "failed">("idle");

  const sections = [
    ["settings-appearance", t("settings.sectionAppearance")],
    ["settings-account", t("settings.sectionData")],
    ["settings-notifications", t("settings.sectionNotifications")],
    ["settings-privacy", t("settings.sectionPrivacy")],
    ["settings-language", t("settings.sectionLanguage")],
    ["settings-player", t("settings.sectionPlayer")],
    ["settings-voice", t("settings.sectionVoice")],
  ] as const;

  async function exportData() {
    if (!apiUrl) return;
    setExportState("busy");
    try {
      const response = await data.send("/me/export", "POST");
      const { token: downloadToken } = (await response.json()) as { token: string };
      window.location.assign(`${apiUrl}/me/export/${downloadToken}`);
      setExportState("idle");
    } catch {
      setExportState("failed");
    }
  }

  return (
    <div className={styles.root}>
      <nav className={styles.nav} aria-label={t("settings.sections")}>
        {sections.map(([id, label]) => (
          <button key={id} type="button" className={styles.link} onClick={() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" })}>{label}</button>
        ))}
      </nav>
      <div className={styles.content}>
        <Section id="settings-appearance" title={t("settings.appearanceTitle")} lead={t("settings.appearanceBody")}>
          <AppearanceControls style={style} mode={mode} onStyle={onStyle} onMode={onMode} />
          <Row title={t("room.hideOthers")}>
            <Check checked={data.prefs.hideOther} onChange={(next) => data.setPref("hideOther", "hideOtherReactions", next)} label={t("room.hideOthers")} />
          </Row>
        </Section>

        <Section id="settings-account" title={t("settings.sectionData")}>
          <Row title="Telegram" hint={`${data.linked}. ${t("settings.unlinkHint")}`}>
            <div className={styles.inline}>
              <div className={styles.grow}><Input icon={Link2} value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="Telegram ID" aria-label="Telegram ID" /></div>
              <Button onClick={() => void data.send("/auth/link-telegram", "POST", { telegramId })}>{t("settings.link")}</Button>
              <Button variant="ghost" onClick={() => void data.send("/auth/unlink-telegram", "POST")}>{t("settings.unlink")}</Button>
            </div>
          </Row>
          <Row title={t("settings.exportData")} hint={exportState === "failed" ? t("settings.exportFailed") : t("settings.exportHint")}>
            <Button icon={Download} loading={exportState === "busy"} data-testid="export-data" onClick={() => void exportData()}>{exportState === "busy" ? t("settings.exportBusy") : t("settings.exportData")}</Button>
          </Row>
          <Row title={t("settings.deleteAccount")} hint={t("settings.deleteHint")}>
            <div className={styles.inline}>
              <Button variant="danger" icon={Trash2} onClick={() => { if (window.confirm(t("settings.deleteConfirm"))) void data.send("/me/delete", "POST", { confirmation: "DELETE" }).catch(() => undefined); }}>{t("settings.delete")}</Button>
              <Button variant="ghost" icon={Undo2} onClick={() => void data.send("/me/restore", "POST").catch(() => undefined)}>{t("settings.restore")}</Button>
            </div>
          </Row>
        </Section>

        <Section id="settings-notifications" title={t("settings.sectionNotifications")} lead={t("settings.notificationsHint")}>{null}</Section>

        <Section id="settings-privacy" title={t("settings.sectionPrivacy")} lead={t("settings.privacyHint")}>
          <Row title={t("settings.friendsVisible")}>
            <Check testId="privacy-friends" checked={data.prefs.friendsPublic} onChange={(next) => data.setPref("friendsPublic", "isFriendsPublic", next)} label={t("settings.friendsVisible")} />
          </Row>
          <Row title={t("settings.historyVisible")}>
            <Check testId="privacy-history" checked={data.prefs.historyPublic} onChange={(next) => data.setPref("historyPublic", "isWatchHistoryPublic", next)} label={t("settings.historyVisible")} />
          </Row>
          <Row title={t("settings.blockedFriends")} hint={t("settings.blockedFriendsHint")}>
            {blocked.length === 0 ? <span className={styles.none}>{t("settings.empty")}</span> : (
              <ul className={styles.people}>{blocked.map((row) => <li key={row.id}>{row.displayName}<Button size="sm" onClick={() => onUnblock?.(row.id)}>{t("settings.remove")}</Button></li>)}</ul>
            )}
          </Row>
          <div data-testid="global-blacklist">
            <Row title={t("settings.globalBlacklist")} hint={t("settings.globalBlacklistHint")}>
              {globalBans.length === 0 ? <span className={styles.none} data-testid="global-blacklist-empty">{t("settings.empty")}</span> : (
                <ul className={styles.people}>
                  {globalBans.map((row) => (
                    <li key={row.id} data-testid="global-ban-row" data-user-id={row.userId}>
                      <span>{row.displayName}{row.reason ? ` · ${row.reason}` : ""}</span>
                      <Button size="sm" data-testid="global-ban-remove" onClick={() => onRemoveGlobalBan?.(row.userId)}>{t("settings.remove")}</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Row>
          </div>
        </Section>

        <Section id="settings-language" title={t("settings.sectionLanguage")} lead={t("settings.russian")}>{null}</Section>

        <Section id="settings-player" title={t("settings.sectionPlayer")} lead={t("settings.playerHint")}>
          <Row title={t("settings.services")} hint={data.services.length === 0 ? t("settings.cobaltMissing") : data.services.join(", ")} />
          <Row title="HLS" hint={t("settings.hlsHint")} />
        </Section>

        <Section id="settings-voice" title={t("settings.sectionVoice")} lead={t("settings.voiceHint")}>{null}</Section>
      </div>
    </div>
  );
}
