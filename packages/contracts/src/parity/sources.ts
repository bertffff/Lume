export interface SourceRule {
  id: string;
  pattern: RegExp;
  embed: boolean;
  premium: boolean;
  chain: readonly string[];
}

export const sourceRules: readonly SourceRule[] = [
  { id: "youtube", pattern: /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)/i, embed: true, premium: false, chain: ["innertube", "cobalt", "ytdlp"] },
  { id: "vk", pattern: /(?:vk\.com\/(?:video|clip)|vkvideo\.ru)/i, embed: true, premium: false, chain: ["cobalt", "vk-api", "ytdlp"] },
  { id: "rutube", pattern: /rutube\.ru\/(?:video|play\/embed|shorts)\//i, embed: true, premium: false, chain: ["rutube-api", "cobalt", "ytdlp", "rutube-puppeteer"] },
  { id: "twitch", pattern: /twitch\.tv\//i, embed: true, premium: false, chain: ["ytdlp", "twitch-gql"] },
  { id: "vimeo", pattern: /vimeo\.com\/(?:video\/)?\d+/i, embed: true, premium: false, chain: ["cobalt", "ytdlp"] },
  { id: "dailymotion", pattern: /(?:dailymotion\.com\/video\/|dai\.ly\/)/i, embed: true, premium: false, chain: ["cobalt", "ytdlp"] },
  { id: "facebook", pattern: /(?:facebook\.com\/(?:watch|reel)\/|fb\.watch\/|facebook\.com\/.*\/videos\/)/i, embed: true, premium: false, chain: ["cobalt", "ytdlp"] },
  { id: "streamable", pattern: /streamable\.com\//i, embed: true, premium: false, chain: ["cobalt", "ytdlp"] },
  { id: "soundcloud", pattern: /soundcloud\.com\/.+\/.+/i, embed: true, premium: false, chain: ["cobalt", "ytdlp"] },
  { id: "tiktok", pattern: /(?:tiktok\.com\/@.+\/video\/|tiktok\.com\/t\/|vm\.tiktok\.com\/)/i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "twitter", pattern: /(?:twitter\.com|x\.com)\/.+\/status\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "instagram", pattern: /instagram\.com\/(?:p|reel|reels|tv)\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "reddit", pattern: /(?:reddit\.com\/r\/.+\/comments\/|redd\.it\/)/i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "bilibili", pattern: /(?:bilibili\.com\/video\/|b23\.tv\/)/i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "ok", pattern: /ok\.ru\/video\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "pinterest", pattern: /pinterest\.com\/pin\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "snapchat", pattern: /(?:snapchat\.com\/(?:spotlight|add)\/|t\.snapchat\.com\/)/i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "bluesky", pattern: /bsky\.app\/profile\/.+\/post\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "xiaohongshu", pattern: /(?:xiaohongshu\.com\/(?:explore|discovery\/item)\/|xhslink\.com\/)/i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "newgrounds", pattern: /newgrounds\.com\/(?:portal\/view|audio\/listen)\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "tumblr", pattern: /tumblr\.com\/post\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "loom", pattern: /loom\.com\/share\//i, embed: false, premium: true, chain: ["cobalt", "ytdlp"] },
  { id: "direct", pattern: /\.(?:mp4|webm|ogg|m3u8|mpd|mkv|avi|mov)(?:$|\?)/i, embed: false, premium: false, chain: [] },
];

export function detectSource(url: string): SourceRule | null {
  return sourceRules.find((rule) => rule.pattern.test(url)) ?? null;
}

export type PlaybackPlan =
  | { type: "direct"; proxy: "hls" | "file" }
  | { type: "embed" }
  | { type: "extract"; chain: readonly string[] }
  | { type: "error"; code: "premium_required" | "unsupported" };

const embedPreferred = new Set(["youtube", "vk", "twitch", "vimeo", "facebook", "streamable", "soundcloud"]);

export function planPlayback(input: { url: string; premium: boolean }): PlaybackPlan {
  const source = detectSource(input.url);
  if (!source) {
    return { type: "error", code: "unsupported" };
  }
  if (source.id === "direct") {
    return { type: "direct", proxy: /\.(?:m3u8|mpd)(?:$|\?)/i.test(input.url) ? "hls" : "file" };
  }
  if (source.id === "youtube" && input.premium) {
    return { type: "extract", chain: source.chain };
  }
  if (embedPreferred.has(source.id)) {
    return { type: "embed" };
  }
  if (source.premium && !input.premium) {
    return { type: "error", code: "premium_required" };
  }
  return { type: "extract", chain: source.chain };
}
