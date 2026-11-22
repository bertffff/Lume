import { useState, type FormEvent } from "react";
import { parseRoomCode } from "@lume/contracts";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import type { CreateRoomWizardSubmission } from "./CreateRoomWizard.js";
import { roomErrorKey, signInErrorKey, type View } from "./views.js";

const PENDING_JOIN_KEY = "lume-pending-room";

interface AuthPayload { accessToken?: string; refreshToken?: string; user?: { id: string; displayName: string } }

/** Signing in, creating or joining a room, and resuming: the actions that move a person from the front door into a room. */
export function useEntry({ session, onSession, onOpen, onJoinNeedsAuth, go, view, hasResume, invitee, setInvitee }: {
  session: ClientSession | null;
  onSession: (session: ClientSession) => void;
  onOpen: (roomId: string) => void;
  onJoinNeedsAuth: (code: string) => void;
  go: (path: string) => void;
  view: View;
  hasResume: boolean;
  invitee: string | null;
  setInvitee: (userId: string | null) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const leaveAuth = () => {
    if (!window.sessionStorage.getItem(PENDING_JOIN_KEY)) go("/");
  };
  const startSession = (payload: AuthPayload) => {
    if (!payload.accessToken || !payload.user) return false;
    onSession({
      accessToken: payload.accessToken,
      ...(payload.refreshToken ? { refreshToken: payload.refreshToken } : {}),
      user: { id: payload.user.id, displayName: payload.user.displayName, telegramId: null, username: null, locale: "ru", themeId: "ember" },
    });
    return true;
  };

  async function signIn(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.devLogin(name.trim() || t("auth.guest"));
      onSession({ accessToken: result.accessToken, ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}), user: result.user });
      if (view === "auth") leaveAuth();
    } catch (caught) {
      setError(caught instanceof ClientError ? t(signInErrorKey(caught.code)) : t("auth.error.generic"));
    }
  }

  async function emailSignIn(event: FormEvent, password: string) {
    event.preventDefault();
    const email = name.trim();
    if (!email.includes("@")) {
      await signIn(event);
      return;
    }
    if (!password) {
      try {
        const response = await fetch(`${apiUrl}/auth/magic-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
        if (!response.ok) throw new Error("magic_link_failed");
        setNotice(t("auth.magicSent"));
      } catch {
        setError(t("auth.magicFailed"));
      }
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = (await response.json().catch(() => ({}))) as AuthPayload;
      if (!response.ok || !startSession(payload)) {
        setError(t(response.status === 429 ? "auth.error.rateLimited" : "auth.error.unauthorized"));
        return;
      }
      leaveAuth();
    } catch {
      setError(t("auth.error.generic"));
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: name, password: String(data.get("password") ?? ""), displayName: String(data.get("displayName") ?? name) }),
      });
      const payload = (await response.json()) as AuthPayload;
      if (startSession(payload)) leaveAuth();
    } catch {
      setError(t("auth.registerFailed"));
    }
  }

  async function createRoom({ initialVideoUrl, ...setup }: CreateRoomWizardSubmission) {
    if (!session) {
      go("/auth");
      return { error: t("auth.signInFirst") };
    }
    setError(null);
    try {
      const result = await api.createRoom(session.accessToken, setup);
      if (initialVideoUrl) {
        try { await api.addRoomVideo(session.accessToken, result.room.id, initialVideoUrl); }
        catch { setNotice(t("create.videoNotAdded")); }
      }
      if (invitee) {
        try { await api.inviteFriend(session.accessToken, result.room.id, invitee); }
        catch { setNotice(t("home.inviteFailed")); }
        setInvitee(null);
      }
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      return { error: caught instanceof ClientError ? t(roomErrorKey(caught.code)) : t("room.createFailed") };
    }
  }

  function updateCode(value: string) {
    setCode(value);
    setCodeInvalid(false);
  }

  async function openResume() {
    if (!session || !hasResume || resuming) return;
    setResuming(true);
    try { onOpen((await api.resumeRoom(session.accessToken)).room.id); }
    catch { setError(t("resume.openFailed")); }
    finally { setResuming(false); }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    const value = parseRoomCode(code);
    if (!value) {
      setCodeInvalid(true);
      return;
    }
    if (!session) {
      updateCode("");
      onJoinNeedsAuth(value);
      return;
    }
    setError(null);
    try {
      const result = await api.joinRoom(session.accessToken, value);
      updateCode("");
      onOpen(result.room.id);
      go("/");
    } catch (caught) {
      setError(caught instanceof ClientError ? (caught.code === "not_found" ? t("room.error.notFound") : t("room.joinFailed")) : t("room.joinFailed"));
    }
  }

  return { name, setName, code, codeInvalid, updateCode, error, setError, notice, resuming, signIn, emailSignIn, register, createRoom, openResume, joinRoom };
}
