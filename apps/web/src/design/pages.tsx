import { useState, type FormEvent, type ReactNode } from "react";
import { roomPresetById, roomPresets, viewerPermissionKeys, type RoomPresetId } from "@lume/contracts";
import { permissionLabel } from "./copy.js";
import { useI18n } from "../i18n/context.js";
import { Modal } from "../ui/index.js";
import { RoomCodeInput } from "./RoomCodeInput.js";

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

