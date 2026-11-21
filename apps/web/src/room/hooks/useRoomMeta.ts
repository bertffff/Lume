import { useEffect, useState } from "react";
import { apiUrl } from "../../api/client.js";
import type { VoicePreflightResult } from "../../voice/preflight.js";

export interface RoomSettingsState {
  title: string;
  hideReactions: boolean;
  defaults: Record<string, boolean> | null;
}

export interface RoomHistoryItem {
  id: string;
  title: string | null;
  url: string;
  source: string;
  watchedAt: string;
}

export interface RoomRecommendation {
  url: string;
  title: string | null;
  reason: string;
}

const defaultPermissions = {
  canChat: true,
  canQueue: true,
  canSpeak: true,
  canReact: true,
  canSeek: false,
  canInvite: true,
};

/** Room metadata, profile flags, ICE servers, history and recommendations. */
export function useRoomMeta(roomId: string | undefined, token: string | undefined, nowPlayingId: string | undefined) {
  const [settings, setSettings] = useState<RoomSettingsState | null>(null);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [iceUrls, setIceUrls] = useState<string[]>([]);
  const [hideOther, setHideOther] = useState(false);
  const [premium, setPremium] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [preflight, setPreflight] = useState<VoicePreflightResult | null>(null);
  const [history, setHistory] = useState<RoomHistoryItem[]>([]);
  const [recommendations, setRecommendations] = useState<RoomRecommendation[]>([]);

  useEffect(() => {
    if (!roomId || !token) return;
    let stopped = false;
    void fetch(`${apiUrl}/rooms/${roomId}/settings`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { title: string; hideReactions?: boolean; defaults?: Record<string, boolean> | null }) => {
        if (stopped) return;
        setSettings({ title: payload.title, hideReactions: Boolean(payload.hideReactions), defaults: payload.defaults ?? null });
        if (payload.defaults) {
          setPermissions({
            canChat: payload.defaults.canChat ?? true,
            canQueue: payload.defaults.canQueue ?? true,
            canSpeak: payload.defaults.canSpeak ?? true,
            canReact: payload.defaults.canReact ?? true,
            canSeek: payload.defaults.canSeek ?? false,
            canInvite: payload.defaults.canInvite ?? true,
          });
        }
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/ice-servers`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { iceServers?: Array<{ urls?: string | string[] }> }) => {
        if (stopped) return;
        setIceUrls(
          (payload.iceServers ?? []).flatMap((server) =>
            Array.isArray(server.urls) ? server.urls : server.urls ? [server.urls] : [],
          ),
        );
      })
      .catch(() => {
        if (!stopped) setIceUrls([]);
      });
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { hideOtherReactions?: boolean; isPremium?: boolean; recentEmojis?: string[] }) => {
        if (stopped) return;
        setHideOther(Boolean(payload.hideOtherReactions));
        setPremium(Boolean(payload.isPremium));
        setRecentEmojis(Array.isArray(payload.recentEmojis) ? payload.recentEmojis : []);
      })
      .catch(() => {
        if (stopped) return;
        setHideOther(false);
        setPremium(false);
        setRecentEmojis([]);
      });
    return () => {
      stopped = true;
    };
  }, [roomId, token]);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    void fetch(`${apiUrl}/voice/preflight`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { preflight?: VoicePreflightResult | null }) => {
        if (!stopped) setPreflight(payload.preflight ?? null);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [token]);

  useEffect(() => {
    if (!roomId || !token) return;
    let stopped = false;
    void fetch(`${apiUrl}/rooms/${roomId}/history`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { history?: RoomHistoryItem[] }) => {
        if (!stopped) setHistory(payload.history ?? []);
      })
      .catch(() => {
        if (!stopped) setHistory([]);
      });
    void fetch(`${apiUrl}/me/discovery?roomId=${encodeURIComponent(roomId)}`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { items?: RoomRecommendation[] }) => {
        if (!stopped) setRecommendations(payload.items ?? []);
      })
      .catch(() => {
        if (!stopped) setRecommendations([]);
      });
    return () => {
      stopped = true;
    };
  }, [roomId, token, nowPlayingId]);

  async function clearHistory(): Promise<void> {
    if (!roomId || !token) return;
    const response = await fetch(`${apiUrl}/rooms/${roomId}/history`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (response?.ok) setHistory([]);
  }

  return {
    settings,
    setSettings,
    permissions,
    setPermissions,
    iceUrls,
    hideOther,
    setHideOther,
    premium,
    recentEmojis,
    setRecentEmojis,
    preflight,
    setPreflight,
    history,
    setHistory,
    recommendations,
    clearHistory,
  };
}
