import type { MediaExtractor } from "@lume/contracts";
import { aspectFrom, expiresAtFromUrl, fetchText, media, type MediaConfig } from "./types.js";

function unescape(url: string): string {
  return url.replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

export function vkVideoRef(input: string): { oid: string; id: string } | null {
  const direct = input.match(/(?:vk\.com|vkvideo\.ru)\/video(-?\d+)_(\d+)/i);
  if (direct?.[1] && direct[2]) return { oid: direct[1], id: direct[2] };
  try {
    const url = new URL(input);
    const oid = url.searchParams.get("oid");
    const id = url.searchParams.get("id");
    if (url.pathname.includes("video_ext.php") && oid && id) return { oid, id };
  } catch {
    return null;
  }
  return null;
}

function cookieList(raw: string | undefined): string[] {
  if (!raw) return [""];
  return raw
    .split("||")
    .map((entry) => entry.trim().replace(/^cookie:\s*/i, ""))
    .filter(Boolean);
}

function titleFromHtml(html: string): string | null {
  const match = html.match(/<title>([^<]{1,200})<\/title>/i);
  if (!match?.[1]) return null;
  return match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function streamFromHtml(html: string): { kind: "hls" | "file"; url: string } | null {
  const hls = html.match(/"hls"\s*:\s*"([^"]+)"/);
  if (hls?.[1]) return { kind: "hls", url: unescape(hls[1]) };
  const dash = html.match(/"dash_uni"\s*:\s*"([^"]+)"/) ?? html.match(/"dash_sep"\s*:\s*"([^"]+)"/);
  if (dash?.[1]) return { kind: "hls", url: unescape(dash[1]) };
  const mp4 = html.match(/"mp4_(\d+)"\s*:\s*"([^"]+)"/);
  if (mp4?.[2]) return { kind: "file", url: unescape(mp4[2]) };
  return null;
}

/** Cookies rotate round-robin; a failed cookie never blocks the next attempt. */
export function createVkExtractor(config: MediaConfig = {}): MediaExtractor {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const base = config.vkBaseUrl ?? "https://vk.com";
  const cookies = cookieList(config.vkCookies);
  let cursor = 0;

  return {
    id: "vk",
    canHandle: (input) => vkVideoRef(input) !== null,
    async resolve(input) {
      const ref = vkVideoRef(input);
      if (!ref) throw new Error("vk_invalid_url");
      const pageUrl = `${base}/video_ext.php?oid=${ref.oid}&id=${ref.id}&hd=2`;
      let lastError = "vk_no_stream";
      for (let attempt = 0; attempt < cookies.length; attempt += 1) {
        const cookie = cookies[(cursor + attempt) % cookies.length] ?? "";
        const html = await fetchText(
          fetchImpl,
          pageUrl,
          {
            headers: {
              accept: "text/html",
              referer: "https://vk.com/",
              "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Lume",
              ...(cookie ? { cookie } : {}),
            },
          },
          timeoutMs,
        );
        if (!html) {
          lastError = "vk_unreachable";
          continue;
        }
        const stream = streamFromHtml(html);
        if (!stream) {
          lastError = /login|вход/i.test(html) ? "vk_auth_required" : "vk_no_stream";
          continue;
        }
        cursor = (cursor + attempt) % cookies.length;
        return media(
          "vk",
          `${ref.oid}_${ref.id}`,
          titleFromHtml(html) ?? `VK ${ref.oid}_${ref.id}`,
          stream,
          { aspectRatio: aspectFrom(16, 9) },
        );
      }
      throw new Error(lastError);
    },
  };
}

export function vkExpiry(url: string): number | null {
  return expiresAtFromUrl(url);
}
