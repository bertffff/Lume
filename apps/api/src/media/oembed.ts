import { oEmbedEndpoint, type ParsedEmbed } from "@lume/contracts";

export async function fetchOEmbedTitle(item: ParsedEmbed): Promise<string | null> {
  const endpoint = oEmbedEndpoint(item);
  if (!endpoint) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { title?: unknown };
    return typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 140)
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
