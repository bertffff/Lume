import { oEmbedEndpoint, type ParsedEmbed } from "@lume/contracts";

export async function fetchOEmbedTitle(item: ParsedEmbed): Promise<{ title: string | null; thumbnailUrl: string | null } | null> {
  const endpoint = oEmbedEndpoint(item) ?? `https://noembed.com/embed?url=${encodeURIComponent(item.url)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { title?: unknown; thumbnail_url?: unknown };
    const title = typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim().slice(0, 140) : null;
    const thumbnailUrl =
      typeof body.thumbnail_url === "string" && body.thumbnail_url.startsWith("http")
        ? body.thumbnail_url
        : null;
    if (!title && !thumbnailUrl) {
      return null;
    }
    return { title, thumbnailUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
