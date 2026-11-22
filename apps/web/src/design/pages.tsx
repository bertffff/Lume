import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { linkedLabel, roomPresetById, roomPresets, viewerPermissionKeys, type RoomPresetId } from "@lume/contracts";
import { permissionLabel } from "./copy.js";
import { useI18n } from "../i18n/context.js";
import { Modal } from "../ui/index.js";
import { type ModeId, type StyleId } from "./theme.js";
import { RoomCodeInput } from "./RoomCodeInput.js";
import { AppearanceControls } from "./AppearanceControls.js";

export function SettingsScreen({
  style,
  mode,
  onStyle,
  onMode,
  token,
  apiUrl,
  blocked = [],
  onUnblock,
  globalBans = [],
  onRemoveGlobalBan,
}: {
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
}) {
  const { t } = useI18n();
  const [telegramId, setTelegramId] = useState("");
  const [linked, setLinked] = useState(() => t("settings.linkedNone"));
  const [services, setServices] = useState<string[]>([]);
  const [friendsPublic, setFriendsPublic] = useState(true);
  const [historyPublic, setHistoryPublic] = useState(true);
  const [hideOther, setHideOther] = useState(false);
  useEffect(() => {
    if (!apiUrl) return;
    void fetch(`${apiUrl}/video/services`).then((response) => response.json()).then((payload: { services?: string[] }) => setServices(payload.services ?? [])).catch(() => setServices([]));
    if (!token) return;
    void fetch(`${apiUrl}/auth/linked-accounts`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { email?: boolean; telegram?: boolean }) => {
        setLinked(linkedLabel({ email: Boolean(payload.email), telegram: Boolean(payload.telegram) }));
      })
      .catch(() => setLinked(t("settings.linkedNo")));
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { isFriendsPublic?: boolean; isWatchHistoryPublic?: boolean; hideOtherReactions?: boolean }) => {
        if (typeof payload.isFriendsPublic === "boolean") setFriendsPublic(payload.isFriendsPublic);
        if (typeof payload.isWatchHistoryPublic === "boolean") setHistoryPublic(payload.isWatchHistoryPublic);
        if (typeof payload.hideOtherReactions === "boolean") setHideOther(payload.hideOtherReactions);
      })
      .catch(() => undefined);
  }, [token, apiUrl, t]);
  return (
    <div className="settings-wrap">
      <aside>
        {([
          [t("settings.sectionAppearance"), "settings-appearance"],
          [t("settings.sectionAccount"), "settings-account"],
          [t("settings.sectionNotifications"), "settings-notifications"],
          [t("settings.sectionPrivacy"), "settings-privacy"],
          [t("settings.sectionLanguage"), "settings-language"],
          [t("settings.sectionPlayer"), "settings-player"],
          [t("settings.sectionVoice"), "settings-voice"],
        ] as const).map(([label, id], index) => (
          <button
            key={id}
            type="button"
            className={index === 0 ? "slink on" : "slink"}
            onClick={() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" })}
          >
            {label}
          </button>
        ))}
      </aside>
      <div className="panel" id="settings-appearance">
        <h2>{t("settings.appearanceTitle")}</h2>
        <p className="lead">{t("settings.appearanceBody")}</p>
        <AppearanceControls style={style} mode={mode} onStyle={onStyle} onMode={onMode} />
        <div className="set-row" id="settings-account">
          <div><b>Telegram</b><small>{linked}. {t("settings.unlinkHint")}</small></div>
          <div className="inline-actions">
            <input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="Telegram ID" aria-label="Telegram ID" />
            <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/link-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ telegramId }) }); }}>{t("settings.link")}</button>
            <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/unlink-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}` } }); }}>{t("settings.unlink")}</button>
          </div>
        </div>
        <div className="set-row" id="settings-notifications"><div><b>{t("settings.sectionNotifications")}</b><small>{t("settings.notificationsHint")}</small></div></div>
        <div className="set-row" id="settings-privacy">
          <div><b>{t("settings.sectionPrivacy")}</b><small>{t("settings.privacyHint")}</small></div>
          <label className="check">
            <input
              data-testid="privacy-friends"
              type="checkbox"
              checked={friendsPublic}
              onChange={(event) => {
                const next = event.target.checked;
                setFriendsPublic(next);
                if (!token || !apiUrl) return;
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isFriendsPublic: next }) }).catch(() => setFriendsPublic(!next));
              }}
            />
            {t("settings.friendsVisible")}
          </label>
          <label className="check">
            <input
              data-testid="privacy-history"
              type="checkbox"
              checked={historyPublic}
              onChange={(event) => {
                const next = event.target.checked;
                setHistoryPublic(next);
                if (!token || !apiUrl) return;
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isWatchHistoryPublic: next }) }).catch(() => setHistoryPublic(!next));
              }}
            />
            {t("settings.historyVisible")}
          </label>
        </div>
        <div className="set-row">
          <div><b>{t("settings.blockedFriends")}</b><small>{t("settings.blockedFriendsHint")}</small>{blocked.map((row) => <small key={row.id}>{row.displayName} <button type="button" onClick={() => onUnblock?.(row.id)}>{t("settings.remove")}</button></small>)}{blocked.length === 0 ? <small>{t("settings.empty")}</small> : null}</div>
        </div>
        <div className="set-row" data-testid="global-blacklist">
          <div>
            <b>{t("settings.globalBlacklist")}</b>
            <small>{t("settings.globalBlacklistHint")}</small>
            {globalBans.length === 0 ? <small data-testid="global-blacklist-empty">{t("settings.empty")}</small> : null}
            {globalBans.map((row) => (
              <small key={row.id} data-testid="global-ban-row" data-user-id={row.userId}>
                {row.displayName}{row.reason ? ` · ${row.reason}` : ""}{" "}
                <button type="button" data-testid="global-ban-remove" onClick={() => onRemoveGlobalBan?.(row.userId)}>{t("settings.remove")}</button>
              </small>
            ))}
          </div>
        </div>
        <div className="set-row" id="settings-language"><div><b>{t("settings.language")}</b><small>{t("settings.russian")}</small></div></div>
        <div className="set-row"><div><b>{t("settings.services")}</b><small>{services.length === 0 ? t("settings.cobaltMissing") : services.join(", ")}</small></div></div>
        <div className="set-row" id="settings-voice"><div><b>{t("settings.sectionVoice")}</b><small>{t("settings.voiceHint")}</small></div></div>
        <div className="set-row"><div><b>HLS</b><small>{t("settings.hlsHint")}</small></div></div>
        <div className="set-row"><div><b>{t("settings.reactions")}</b><button type="button" onClick={() => { if (!token || !apiUrl) return; const next = !hideOther; setHideOther(next); void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ hideOtherReactions: next }) }).catch(() => setHideOther(!next)); }}>{hideOther ? t("room.showOthers") : t("room.hideOthers")}</button></div></div>
        <div className="set-row"><div><b>Telegram</b><small>{linked.includes("Telegram") ? t("settings.telegramOn") : t("settings.telegramOff")}</small></div></div>
        <div className="set-row" id="settings-player"><div><b>{t("settings.sectionPlayer")}</b><small>{t("settings.playerHint")}</small></div></div>
        <div className="set-row">
          <div><b>{t("settings.deleteAccount")}</b><small>{t("settings.deleteHint")}</small></div>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; if (!window.confirm(t("settings.deleteConfirm"))) return; void fetch(`${apiUrl}/me/delete`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) }).catch(() => undefined); }}>{t("settings.delete")}</button>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/me/restore`, { method: "POST", headers: { authorization: `Bearer ${token}` } }); }}>{t("settings.restore")}</button>
        </div>
      </div>
    </div>
  );
}

export function AuthScreen({ onTelegram, name, onName, onEmail, onRegister }: {
  onTelegram: () => void;
  name: string;
  onName: (value: string) => void;
  onEmail: (event: FormEvent) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  return (
    <div className="auth-wrap">
      <div className="brand">
        <div className="logo"><i className="spot" />lume</div>
        <h1>{t("auth.heroTitle")}</h1>
        <p>{t("auth.heroBody")}</p>
      </div>
      <form className="auth-card" onSubmit={tab === "register" ? onRegister : onEmail}>
        <div className="tabs2">
          <button type="button" className={tab === "login" ? "tab on" : "tab"} onClick={() => setTab("login")}>{t("auth.loginTab")}</button>
          <button type="button" className={tab === "register" ? "tab on" : "tab"} onClick={() => setTab("register")}>{t("auth.registerTab")}</button>
        </div>
        <button type="button" className="tg-btn" onClick={onTelegram}>{t("mobile.telegram")}</button>
        <div className="or">{t("auth.orEmail")}</div>
        <label className="field">{t("auth.email")}<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder="albert@example.com" /></label>
        <label className="field">{t("auth.password")}<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {tab === "register" ? <label className="field">{t("auth.name")}<input name="displayName" defaultValue={name.split("@")[0] || t("auth.guest")} /></label> : null}
        <button className="btn btn-primary" type="submit" data-testid="lobby-sign-in">{tab === "register" ? t("auth.register") : t("auth.login")}</button>
      </form>
    </div>
  );
}

export function PremiumScreen() {
  const { t } = useI18n();
  return (
    <div className="wrap shop-wrap">
      <h1>{t("premium.title")}</h1>
      <p className="lead">{t("premium.body")}</p>
      <div className="empty">
        <h2>{t("premium.emptyTitle")}</h2>
        <p>{t("premium.emptyBody")}</p>
      </div>
    </div>
  );
}

export function NotificationsScreen({ items }: { items: Array<{ id: string; kind: string; title: string; body: string }> }) {
  const { t } = useI18n();
  return (
    <div className="notifications-page">
      <aside className="npanel">
        <div className="mh"><h2>{t("notifications.title")}</h2><span className="sp" /><span>{items.length}</span></div>
        {items.length === 0 ? <p className="empty-note">{t("profile.noNotifications")}</p> : items.map((item) => (
          <div className="nitem" key={item.id} data-kind={item.kind}><div><div className="t">{item.title}</div><div className="s">{item.body}</div></div></div>
        ))}
      </aside>
    </div>
  );
}

export function CreateScreen({ title, onTitle, preset, onPreset, onSubmit, onCancel, busy = false }: {
  title: string;
  onTitle: (value: string) => void;
  preset: RoomPresetId | null;
  onPreset: (value: RoomPresetId) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const chosen = preset ? roomPresetById(preset) : null;
  return (
    <Modal
      open
      title={t("create.title")}
      onClose={() => onCancel?.()}
      lg
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("join.back")}</button>
          <button className="btn btn-primary" type="submit" form="create-room-form" data-testid="lobby-create" disabled={busy}>
            {busy ? t("create.creating") : t("create.submit")}
          </button>
        </>
      }
    >
      <form id="create-room-form" onSubmit={onSubmit} className="create-form">
        <p className="lead">{t("create.step")}</p>
        <div className="steps"><span className="on" /><span className="on" /><span /></div>
        <label className="field">{t("create.roomName")}
          <input data-testid="lobby-title" value={title} onChange={(event) => onTitle(event.target.value)} placeholder={t("create.namePlaceholder")} autoFocus />
        </label>
        <div>
          <div className="choice-label">{t("create.preset")}</div>
          <div className="chips" data-testid="create-presets">
            {roomPresets.map((item) => (
              <button
                key={item.id}
                type="button"
                className={preset === item.id ? "pill on" : "pill"}
                data-testid={`create-preset-${item.id}`}
                onClick={() => {
                  onPreset(item.id);
                  onTitle(item.title);
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="choice-label">{t("create.who")}</div>
          <div className="choices">
            <div className={chosen && !chosen.isPublic ? "choice on" : "choice"}><b>{t("create.byCode")}</b><p>{t("create.byCodeHint")}</p></div>
            <div className={chosen?.isPublic ? "choice on" : "choice"}><b>{t("create.public")}</b><p>{t("create.publicHint")}</p></div>
          </div>
        </div>
        {chosen ? (
          <p className="lead" data-testid="create-preset-summary" data-max={chosen.maxMembers} data-public={chosen.isPublic ? "true" : "false"} data-slow={chosen.slowModeSeconds}>
            {chosen.hint} · {t("create.limit", { count: chosen.maxMembers })}
          </p>
        ) : null}
        <div>
          <div className="choice-label">{t("create.rights")}</div>
          <div className="choices" data-testid="create-preset-rights">
            {viewerPermissionKeys.map((key) => (
              <div key={key} className={chosen?.defaults[key] ? "choice on" : "choice"}>
                <b>{permissionLabel(key, t)}</b>
                <p>{chosen ? (chosen.defaults[key] ? t("create.allowed") : t("create.denied")) : t("create.fromPreset")}</p>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function JoinScreen({ code, codeInvalid, onCode, onSubmit, onCancel }: { code: string; codeInvalid: boolean; onCode: (value: string) => void; onSubmit: (event: FormEvent) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  return (
    <Modal
      open
      title={t("join.title")}
      onClose={() => onCancel?.()}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("common.cancel")}</button>
          <button className="btn btn-primary" type="submit" form="join-room-form" data-testid="lobby-join">{t("auth.login")}</button>
        </>
      }
    >
      <form id="join-room-form" onSubmit={onSubmit}>
        <p className="lead">{t("join.subtitle")}</p>
        <RoomCodeInput value={code} onChange={onCode} invalid={codeInvalid} autoFocus />
        <p className="lead">{t("join.hint")}</p>
      </form>
    </Modal>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  return (
    <div className="overlay docked"><div className="modal">
      <div className="mh"><h2>{t("onboarding.welcome")}</h2><span>{t("onboarding.step")}</span></div>
      <div className="mb">
        <div className="steps"><span className="on" /><span /><span /></div>
        <h3>{t("onboarding.title")}</h3>
        <p>{t("onboarding.body")}</p>
      </div>
      <div className="mf"><button type="button" className="btn btn-ghost" onClick={onDone}>{t("join.skip")}</button><button type="button" className="btn btn-primary" onClick={onDone}>{t("join.next")}</button></div>
    </div></div>
  );
}

export function EmptyScreen({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="page-body"><div className="empty"><h2>{title}</h2>{body ? <p>{body}</p> : null}{action}</div></div>
  );
}

