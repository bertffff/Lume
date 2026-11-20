import { ExtractorRegistry, type MediaExtractor, type ResolvedMedia } from "@lume/contracts";
import { createCobaltExtractor } from "./cobalt.js";
import { createRutubeExtractor } from "./rutube.js";
import { createTwitchExtractor } from "./twitch.js";
import { createVkExtractor } from "./vk.js";
import { createYouTubeExtractor } from "./youtube.js";
import { createYtDlpExtractor } from "./ytdlp.js";
import type { MediaConfig } from "./types.js";

export { createCobaltExtractor } from "./cobalt.js";
export { createRutubeExtractor, rutubeVideoId } from "./rutube.js";
export { createTwitchExtractor, twitchRef } from "./twitch.js";
export { createVkExtractor, vkVideoRef } from "./vk.js";
export { createYouTubeExtractor, youtubeVideoId } from "./youtube.js";
export { createYtDlpExtractor } from "./ytdlp.js";
export { searchVideos, type VideoSearchResult } from "./search.js";
export type { MediaConfig } from "./types.js";

export interface RegistryReport {
  registry: ExtractorRegistry;
  extractors: MediaExtractor[];
  enabled: string[];
  disabled: Array<{ id: string; reason: string }>;
}

/**
 * Provider-specific adapters run first; Cobalt and yt-dlp are catch-all
 * fallbacks and only appear when their credentials are present.
 */
export function createMediaRegistry(config: MediaConfig = {}): RegistryReport {
  const enabled: string[] = [];
  const disabled: Array<{ id: string; reason: string }> = [];
  const extractors: MediaExtractor[] = [];

  const add = (extractor: MediaExtractor, reason: string) => {
    enabled.push(extractor.id);
    extractors.push(extractor);
    void reason;
  };
  const skip = (id: string, reason: string) => disabled.push({ id, reason });

  const youtube = createYouTubeExtractor(config);
  add(youtube, "always");
  const rutube = createRutubeExtractor(config);
  add(rutube, "always");
  add(createVkExtractor(config), "always");
  const twitch = createTwitchExtractor(config);
  if (config.twitchClientId) {
    add(twitch, "client id");
  } else {
    skip("twitch", "twitch_unconfigured");
  }
  if (config.cobaltApiUrl) {
    add(createCobaltExtractor(config), "cobalt url");
  } else {
    skip("cobalt", "cobalt_unconfigured");
  }
  if (config.ytdlpPath) {
    add(createYtDlpExtractor(config), "ytdlp path");
  } else {
    skip("ytdlp", "ytdlp_unconfigured");
  }

  return { registry: new ExtractorRegistry(extractors), extractors, enabled, disabled };
}

export type ChainResult =
  | { status: "resolved"; media: ResolvedMedia; extractorId: string }
  | { status: "no_extractor"; attempts: [] }
  | { status: "failed"; attempts: Array<{ id: string; error: string }> };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("extractor_timeout")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Tries every configured adapter that accepts the input, in registry order.
 * Provider-specific failures fall through to Cobalt and yt-dlp.
 */
export async function resolveMediaChain(
  report: RegistryReport,
  input: string,
  timeoutMs = 15_000,
): Promise<ChainResult> {
  const candidates = report.extractors.filter((extractor) => extractor.canHandle(input));
  if (candidates.length === 0) return { status: "no_extractor", attempts: [] };
  const attempts: Array<{ id: string; error: string }> = [];
  for (const extractor of candidates) {
    try {
      const media = await withTimeout(extractor.resolve(input), timeoutMs);
      return { status: "resolved", media, extractorId: extractor.id };
    } catch (error) {
      attempts.push({
        id: extractor.id,
        error: error instanceof Error ? error.message : "extract_failed",
      });
    }
  }
  return { status: "failed", attempts };
}

/** Returns the adapter id that would handle this URL, without resolving it. */
export function extractorFor(config: MediaConfig, input: string): string | null {
  return createMediaRegistry(config).registry.find(input)?.id ?? null;
}
