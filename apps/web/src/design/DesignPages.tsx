import type { FormEvent } from "react";
import { apiUrl } from "../api/client.js";
import { Button } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import { AuthScreen } from "../screens/entry/AuthScreen.js";
import { EmptyScreen } from "../screens/entry/EmptyScreen.js";
import { JoinScreen } from "../screens/entry/JoinScreen.js";
import { OnboardingScreen } from "../screens/entry/OnboardingScreen.js";
import { PremiumScreen } from "../screens/entry/PremiumScreen.js";
import { NotificationInboxPage, type NotificationInboxProps } from "../screens/notifications/NotificationInbox.js";
import { ProfileScreen } from "../screens/profile/ProfileScreen.js";
import { SearchScreen } from "../screens/search/SearchScreen.js";
import { SettingsScreen } from "../screens/settings/SettingsScreen.js";
import type { ClientSession } from "../session.js";
import { Page } from "../shell/Page.js";
import { AppearanceControls } from "./AppearanceControls.js";
import { CreateRoomWizard, type CreateRoomWizardLabels, type CreateRoomWizardSubmission } from "./CreateRoomWizard.js";
import type { StyleId, ThemeMode } from "./theme.js";
import type { View } from "./views.js";

export interface DesignPagesProps {
  view: View;
  session: ClientSession | null;
  go: (path: string) => void;
  style: StyleId;
  mode: ThemeMode;
  onAppearance: (style: StyleId, mode: ThemeMode) => void;
  query: string;
  onQuery: (value: string) => void;
  inbox: NotificationInboxProps;
  joiningInvite: boolean;
  isShot: boolean;
  wizardLabels: CreateRoomWizardLabels;
  onCreateRoom: (setup: CreateRoomWizardSubmission) => Promise<void | { error: string }>;
  onCloseWizard: () => void;
  entry: {
    name: string;
    setName: (value: string) => void;
    code: string;
    codeInvalid: boolean;
    updateCode: (value: string) => void;
    joinRoom: (event: FormEvent) => Promise<void>;
    signIn: (event: FormEvent) => Promise<void>;
    emailSignIn: (event: FormEvent, password: string) => Promise<void>;
    register: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  };
  account: {
    blocked: Array<{ id: string; displayName: string }>;
    unblock: (id: string) => void;
    globalBans: Array<{ id: string; userId: string; displayName: string; reason: string | null }>;
    removeGlobalBan: (userId: string) => void;
  };
}

/** Every secondary screen behind the back-button page frame; the shell decides which one is current. */
export function DesignPages({ view, session, go, style, mode, onAppearance, query, onQuery, inbox, joiningInvite, isShot, wizardLabels, onCreateRoom, onCloseWizard, entry, account }: DesignPagesProps) {
  const { t } = useI18n();
  const appearance = <AppearanceControls style={style} mode={mode} onStyle={(next) => onAppearance(next, mode)} onMode={(next) => onAppearance(style, next)} />;
  return (
    <Page title={view} onClose={() => go("/")}>
      {view === "search" ? <SearchScreen apiUrl={apiUrl} query={query} onQuery={onQuery} /> : null}
      {view === "create" ? <CreateRoomWizard open labels={wizardLabels} onSubmit={onCreateRoom} onClose={onCloseWizard} /> : null}
      {view === "join" ? (joiningInvite && !isShot
        ? <EmptyScreen title={t("join.connecting")} />
        : <JoinScreen code={entry.code} codeInvalid={entry.codeInvalid} onCode={entry.updateCode} onSubmit={(event) => void entry.joinRoom(event)} onCancel={() => go("/")} />) : null}
      {view === "settings" ? (
        <SettingsScreen style={style} mode={mode} onStyle={(next) => onAppearance(next, mode)} onMode={(next) => onAppearance(style, next)} token={session?.accessToken} apiUrl={apiUrl}
          blocked={account.blocked} onUnblock={account.unblock} globalBans={account.globalBans} onRemoveGlobalBan={account.removeGlobalBan} />
      ) : null}
      {view === "profile" ? (session
        ? <ProfileScreen token={session.accessToken} apiUrl={apiUrl} userId={session.user.id} displayName={session.user.displayName} appearance={appearance} />
        : <EmptyScreen title={t("profile.signInTitle")} body={t("profile.signInBody")} action={<Button variant="primary" onClick={() => go("/auth")}>{t("auth.login")}</Button>} />) : null}
      {view === "premium" ? <PremiumScreen /> : null}
      {view === "notifications" ? <NotificationInboxPage {...inbox} /> : null}
      {view === "onboarding" ? <OnboardingScreen onDone={() => { window.localStorage.setItem("lume-onboarded", "1"); go("/"); }} /> : null}
      {view === "auth" ? (
        <AuthScreen name={entry.name} onName={entry.setName} onTelegram={() => void entry.signIn({ preventDefault() {} } as FormEvent)}
          onEmail={(event, password) => void entry.emailSignIn(event, password)} onRegister={(event) => void entry.register(event)} />
      ) : null}
      {view === "missing" ? (
        <EmptyScreen title={t("empty.notFoundTitle")} body={t("empty.notFoundBody")}
          action={<><Button onClick={() => go("/")}>{t("empty.home")}</Button><Button variant="primary" onClick={() => { entry.updateCode(""); go("/join"); }}>{t("empty.tryRoomCode")}</Button></>} />
      ) : null}
      {view === "offline" ? <EmptyScreen title={t("empty.offlineTitle")} body={t("empty.offlineBody")} action={<Button variant="primary" onClick={() => window.location.reload()}>{t("common.retry")}</Button>} /> : null}
    </Page>
  );
}
