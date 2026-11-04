import { z } from "zod";

export const embedProviderSchema = z.enum([
  "youtube",
  "vk",
  "rutube",
  "twitch",
  "vimeo",
  "direct",
]);

export type EmbedProvider = z.infer<typeof embedProviderSchema>;

export interface ParsedEmbed {
  provider: EmbedProvider;
  externalId: string;
  url: string;
  titleHint: string;
}

function youtube(id: string, url: string): ParsedEmbed | null {
  if (!/^[\w-]{6,}$/.test(id)) {
    return null;
  }
  return { provider: "youtube", externalId: id, url, titleHint: `YouTube ${id}` };
}

export function parseEmbedInput(input: string): ParsedEmbed | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter((part) => part.length > 0);
  const original = url.toString();

  if (host === "youtu.be") {
    return parts[0] ? youtube(parts[0], original) : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const watchId = url.searchParams.get("v");
    if (watchId) {
      return youtube(watchId, original);
    }
    if ((parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") && parts[1]) {
      return youtube(parts[1], original);
    }
  }
  if (host === "vk.com" || host === "vkvideo.ru") {
    const match = `${url.pathname}${url.search}`.match(/video(-?\d+)_(\d+)/);
    if (match?.[1] && match[2]) {
      return {
        provider: "vk",
        externalId: `${match[1]}_${match[2]}`,
        url: original,
        titleHint: `VK ${match[2]}`,
      };
    }
  }
  if (host === "rutube.ru") {
    const videoAt = parts.indexOf("video");
    const embedAt = parts.indexOf("embed");
    const id = videoAt >= 0 ? parts[videoAt + 1] : embedAt >= 0 ? parts[embedAt + 1] : undefined;
    if (id) {
      return { provider: "rutube", externalId: id, url: original, titleHint: `Rutube ${id.slice(0, 8)}` };
    }
  }
  if (host === "twitch.tv" || host === "m.twitch.tv") {
    if (parts[0] === "videos" && parts[1]) {
      return {
        provider: "twitch",
        externalId: `video:${parts[1]}`,
        url: original,
        titleHint: `Twitch ${parts[1]}`,
      };
    }
    if (parts[0] && parts[0] !== "directory") {
      return {
        provider: "twitch",
        externalId: `channel:${parts[0]}`,
        url: original,
        titleHint: `Twitch ${parts[0]}`,
      };
    }
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = [...parts].reverse().find((part) => /^\d+$/.test(part));
    if (id) {
      return { provider: "vimeo", externalId: id, url: original, titleHint: `Vimeo ${id}` };
    }
  }
  return {
    provider: "direct",
    externalId: original,
    url: original,
    titleHint: host,
  };
}

export function isHlsUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return url.toLowerCase().includes(".m3u8");
  }
}

export type PlayerKind = EmbedProvider | "hls" | "file";

/** Which adapter should mount. Direct URLs split into HLS and a plain file. */
export function playerKind(item: { provider: EmbedProvider; url: string }): PlayerKind {
  if (item.provider !== "direct") {
    return item.provider;
  }
  return isHlsUrl(item.url) ? "hls" : "file";
}

export function mediaFallbackTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 80);
  }
}

export function embedSrc(
  item: { provider: EmbedProvider; externalId: string },
  parentHost: string,
): string {
  const parent = parentHost.split(":")[0] || "localhost";
  switch (item.provider) {
    case "youtube":
      return `https://www.youtube.com/embed/${encodeURIComponent(item.externalId)}?enablejsapi=1`;
    case "vk": {
      const [oid, id] = item.externalId.split("_");
      return `https://vk.com/video_ext.php?oid=${oid ?? ""}&id=${id ?? ""}&hd=2`;
    }
    case "rutube":
      return `https://rutube.ru/play/embed/${encodeURIComponent(item.externalId)}`;
    case "twitch":
      if (item.externalId.startsWith("video:")) {
        return `https://player.twitch.tv/?video=${encodeURIComponent(item.externalId.slice(6))}&parent=${parent}`;
      }
      return `https://player.twitch.tv/?channel=${encodeURIComponent(item.externalId.replace(/^channel:/, ""))}&parent=${parent}`;
    case "vimeo":
      return `https://player.vimeo.com/video/${encodeURIComponent(item.externalId)}`;
    case "direct":
      return item.externalId;
  }
}

export function oEmbedEndpoint(item: ParsedEmbed): string | null {
  if (item.provider === "youtube") {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(item.url)}`;
  }
  if (item.provider === "vimeo") {
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(item.url)}`;
  }
  if (item.provider === "rutube") {
    return `https://rutube.ru/api/oembed/?format=json&url=${encodeURIComponent(item.url)}`;
  }
  return null;
}
