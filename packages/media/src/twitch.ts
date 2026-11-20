import type { MediaExtractor } from "@lume/contracts";
import { aspectFrom, fetchJson, media, type MediaConfig } from "./types.js";

const GQL_HASH = "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712";

interface TwitchRef {
  kind: "channel" | "vod";
  id: string;
}

export function twitchRef(input: string): TwitchRef | null {
  try {
    const url = new URL(input);
    if (!/(^|\.)twitch\.tv$/.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "videos" && parts[1]) return { kind: "vod", id: parts[1] };
    if (parts[0] === "clip") return null;
    if (parts[0]) return { kind: "channel", id: parts[0].toLowerCase() };
  } catch {
    return null;
  }
  return null;
}

interface GqlToken {
  data?: {
    streamPlaybackAccessToken?: { signature?: string; value?: string };
    videoPlaybackAccessToken?: { signature?: string; value?: string };
  };
}

function tokenExpiry(value: string): number | null {
  try {
    const parsed = JSON.parse(value) as { expires?: number };
    return typeof parsed.expires === "number" ? parsed.expires * 1000 : null;
  } catch {
    return null;
  }
}

/** Optional Helix title lookup; needs both the client id and the secret. */
async function helixTitle(
  fetchImpl: typeof fetch,
  clientId: string,
  clientSecret: string,
  login: string,
  timeoutMs: number,
): Promise<string | null> {
  const token = await fetchJson(
    fetchImpl,
    "https://id.twitch.tv/oauth2/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }).toString(),
    },
    timeoutMs,
  );
  const accessToken = token?.access_token;
  if (typeof accessToken !== "string") return null;
  const streams = await fetchJson(
    fetchImpl,
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
    { headers: { "client-id": clientId, authorization: `Bearer ${accessToken}` } },
    timeoutMs,
  );
  const data = streams?.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const title = (data[0] as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title : null;
}

export function createTwitchExtractor(config: MediaConfig = {}): MediaExtractor {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const gqlUrl = config.twitchGqlUrl ?? "https://gql.twitch.tv/gql";
  const usherBase = config.usherBaseUrl ?? "https://usher.ttvnw.net";

  return {
    id: "twitch",
    canHandle: (input) => twitchRef(input) !== null && Boolean(config.twitchClientId),
    async resolve(input) {
      const ref = twitchRef(input);
      if (!ref) throw new Error("twitch_invalid_url");
      if (!config.twitchClientId) throw new Error("twitch_unconfigured");
      const isLive = ref.kind === "channel";
      const body = (await fetchJson(
        fetchImpl,
        gqlUrl,
        {
          method: "POST",
          headers: {
            "client-id": config.twitchClientId,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            operationName: "PlaybackAccessToken",
            variables: {
              isLive,
              login: isLive ? ref.id : "",
              isVod: !isLive,
              vodID: isLive ? "" : ref.id,
              playerType: "site",
            },
            extensions: { persistedQuery: { version: 1, sha256Hash: GQL_HASH } },
          }),
        },
        timeoutMs,
      )) as GqlToken | null;
      if (!body) throw new Error("twitch_unreachable");
      const token = isLive
        ? body.data?.streamPlaybackAccessToken
        : body.data?.videoPlaybackAccessToken;
      if (!token?.value || !token.signature) {
        throw new Error(isLive ? "twitch_offline" : "twitch_no_vod");
      }
      const query = new URLSearchParams({
        sig: token.signature,
        token: token.value,
        allow_source: "true",
        allow_audio_only: "true",
        player: "twitchweb",
      });
      const hls = isLive
        ? `${usherBase}/api/channel/hls/${ref.id}.m3u8?${query.toString()}`
        : `${usherBase}/vod/${ref.id}.m3u8?${query.toString()}`;
      const title =
        (isLive && config.twitchClientSecret
          ? await helixTitle(fetchImpl, config.twitchClientId, config.twitchClientSecret, ref.id, timeoutMs).catch(
              () => null,
            )
          : null) ?? `${isLive ? "Twitch" : "Twitch VOD"} ${ref.id}`;
      return media("twitch", ref.id, title, { kind: "hls", url: hls }, { aspectRatio: aspectFrom(16, 9) });
    },
  };
}

export function twitchExpiry(value: string): number | null {
  return tokenExpiry(value);
}
