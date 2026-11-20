import { extractorsEnabled, type ResolvedMedia } from "@lume/contracts";
import { createMediaRegistry, resolveMediaChain, type MediaConfig } from "@lume/media";

export const mediaResolveQueue = "media.resolve";

export interface MediaResolveJob {
  input: string;
  requestedBy: string;
}

export type MediaResolveResult =
  | { status: "disabled"; input: string }
  | { status: "no_extractor"; input: string }
  | { status: "resolved"; media: ResolvedMedia }
  | { status: "failed"; input: string; error: string };

export interface MediaResolverEnv {
  FF_EXTRACTORS?: string | undefined;
  MEDIA_EXTRACTOR_TIMEOUT_MS?: number | undefined;
  COBALT_API_URL?: string | undefined;
  YTDLP_PATH?: string | undefined;
  VK_COOKIES?: string | undefined;
  TWITCH_CLIENT_ID?: string | undefined;
  TWITCH_CLIENT_SECRET?: string | undefined;
  SEARXNG_URL?: string | undefined;
}

export function mediaConfigFromEnv(env: MediaResolverEnv): MediaConfig {
  return {
    ...(env.COBALT_API_URL ? { cobaltApiUrl: env.COBALT_API_URL } : {}),
    ...(env.YTDLP_PATH ? { ytdlpPath: env.YTDLP_PATH } : {}),
    ...(env.VK_COOKIES ? { vkCookies: env.VK_COOKIES } : {}),
    ...(env.TWITCH_CLIENT_ID ? { twitchClientId: env.TWITCH_CLIENT_ID } : {}),
    ...(env.TWITCH_CLIENT_SECRET ? { twitchClientSecret: env.TWITCH_CLIENT_SECRET } : {}),
    ...(env.SEARXNG_URL ? { searxngUrl: env.SEARXNG_URL } : {}),
    ...(env.MEDIA_EXTRACTOR_TIMEOUT_MS ? { timeoutMs: env.MEDIA_EXTRACTOR_TIMEOUT_MS } : {}),
  };
}

export interface MediaResolver {
  (job: MediaResolveJob): Promise<MediaResolveResult>;
  readonly enabled: boolean;
  readonly adapters: string[];
  readonly disabledAdapters: Array<{ id: string; reason: string }>;
}

/**
 * The registry is built once at startup. Every live adapter is opt-in through
 * FF_EXTRACTORS; without it the job reports `disabled` instead of guessing.
 */
export function createMediaResolver(env: MediaResolverEnv, config: MediaConfig = {}): MediaResolver {
  const report = createMediaRegistry({ ...mediaConfigFromEnv(env), ...config });
  const enabled = extractorsEnabled(env.FF_EXTRACTORS);
  const resolver = async (job: MediaResolveJob): Promise<MediaResolveResult> => {
    if (!enabled) return { status: "disabled", input: job.input };
    const outcome = await resolveMediaChain(report, job.input, env.MEDIA_EXTRACTOR_TIMEOUT_MS ?? 15_000);
    if (outcome.status === "no_extractor") return { status: "no_extractor", input: job.input };
    if (outcome.status === "failed") {
      return {
        status: "failed",
        input: job.input,
        error: outcome.attempts.map((attempt) => `${attempt.id}:${attempt.error}`).join(";") || "extract_failed",
      };
    }
    return { status: "resolved", media: outcome.media };
  };
  return Object.assign(resolver, {
    enabled,
    adapters: report.enabled,
    disabledAdapters: report.disabled,
  });
}

/** Resolves a single URL outside the queue, used by scheduled refreshes. */
export function createUrlResolver(
  env: MediaResolverEnv,
  config: MediaConfig = {},
): { enabled: boolean; resolve: (url: string) => Promise<ResolvedMedia | null> } {
  const resolver = createMediaResolver(env, config);
  return {
    enabled: resolver.enabled,
    resolve: async (url) => {
      const result = await resolver({ input: url, requestedBy: "scheduler" });
      return result.status === "resolved" ? result.media : null;
    },
  };
}
