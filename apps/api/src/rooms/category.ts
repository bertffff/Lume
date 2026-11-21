import type { RoomCategory, RoomCategorySelection } from "@lume/contracts";

/**
 * Trusted metadata about the *current* video. Callers must populate these
 * fields from server-resolved media data; a client-declared type is not
 * evidence. Unknown / absent values are handled by falling back to `other`.
 */
export interface CategoryMetadata {
  category?: string | null;
  title?: string | null;
  channel?: string | null;
  source?: string | null;
}

const KNOWN_CATEGORIES = new Set<RoomCategory>(["film", "music", "vlog", "other"]);

/** Sources that are unambiguously music platforms. Hosts like YouTube/VK/Rutube are deliberately absent. */
const DECISIVE_MUSIC_SOURCES = new Set(["soundcloud", "bandcamp", "spotify", "deezer"]);

export function mediaCategorySource(url: string, provider: string): string {
  const host = new URL(url).hostname;
  return [...DECISIVE_MUSIC_SOURCES].find((source) => host === `${source}.com` || host.endsWith(`.${source}.com`)) ?? provider;
}

interface KeywordRule {
  category: Exclude<RoomCategory, "other">;
  pattern: RegExp;
}

/** Ordered only for determinism; a match in more than one category is treated as ambiguous. */
const KEYWORD_RULES: readonly KeywordRule[] = [
  { category: "film", pattern: /(?:фильм|кино|сериал|movie|film|cinema|трейлер|trailer)/iu },
  { category: "music", pattern: /(?:музык|песн|клип|music|song|альбом|album|концерт|concert)/iu },
  { category: "vlog", pattern: /(?:влог|vlog|блог|blog)/iu },
];

function normalizedCategory(value: string | null | undefined): RoomCategory | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toLowerCase();
  return KNOWN_CATEGORIES.has(candidate as RoomCategory) ? (candidate as RoomCategory) : null;
}

/**
 * Keyword signal from title/channel text. Returns null when there is no
 * signal, `other` when two or more categories compete (ambiguous), otherwise
 * the single matched category.
 */
function keywordCategory(metadata: CategoryMetadata): RoomCategory | null {
  const text = `${metadata.title ?? ""} ${metadata.channel ?? ""}`;
  const matches = KEYWORD_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.category);
  if (matches.length === 1) return matches[0] ?? null;
  if (matches.length > 1) return "other";
  return null;
}

function sourceCategory(source: string | null | undefined): RoomCategory | null {
  if (typeof source !== "string") return null;
  return DECISIVE_MUSIC_SOURCES.has(source.trim().toLowerCase()) ? "music" : null;
}

/**
 * Classify the current video into a stable category.
 *
 * Precedence (first decisive step wins):
 *   1. Trusted metadata category, when it is one of the closed set — including
 *      an explicit `other`, which beats any music-looking keywords/source.
 *   2. Unambiguous keywords from title/channel; competing categories yield
 *      `other` rather than an arbitrary pick.
 *   3. Decisive source features (dedicated music platforms only).
 *   4. Fallback `other` for absent or unrecognised information.
 *
 * Pure: no network, no I/O, no mutation of `metadata`.
 */
export function classifyRoomCategory(metadata: CategoryMetadata = {}): RoomCategory {
  const trusted = normalizedCategory(metadata.category);
  if (trusted !== null) return trusted;

  const fromKeywords = keywordCategory(metadata);
  if (fromKeywords !== null) return fromKeywords;

  return sourceCategory(metadata.source) ?? "other";
}

/**
 * Resolve the effective category from a host selection and the current video.
 *
 * An explicit concrete selection (including `other`) always wins, including
 * over music metadata. `auto` re-classifies on every call, so it follows the
 * current video as that video changes. Queue additions do not call this and
 * therefore cannot change the category of the playing video.
 */
export function resolveEffectiveCategory(
  selection: RoomCategorySelection | undefined,
  metadata: CategoryMetadata = {},
): RoomCategory {
  const explicit = normalizedCategory(selection);
  return explicit ?? classifyRoomCategory(metadata);
}
