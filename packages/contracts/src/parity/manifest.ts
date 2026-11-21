function absoluteUrl(reference: string, base: string): string {
  return new URL(reference, base).toString();
}

function proxyLine(target: string, source: string, endpoint: string): string {
  const params = new URLSearchParams({ url: target, source });
  return `${endpoint}?${params.toString()}`;
}

function xmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** DASH templates keep `$Number$`-style tokens literal; clients substitute them. */
function proxyTemplateLine(target: string, source: string, endpoint: string): string {
  const encoded = encodeURIComponent(target).replace(/%24([A-Za-z0-9%]+)%24/g, (_match, token: string) => {
    return `$${decodeURIComponent(token)}$`;
  });
  return `${endpoint}?url=${encoded}&source=${encodeURIComponent(source)}`;
}

/** Rewrite HLS segment, variant, and URI lines through the proxy. */
export function rewriteHlsManifest(body: string, baseUrl: string, source: string, endpoint: string): string {
  const lines = body.split(/\r?\n/);
  const master = lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"));
  const rewritten = lines.map((line) => {
    if (line.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        return `URI="${proxyLine(absoluteUrl(uri, baseUrl), source, endpoint)}"`;
      });
    }
    if (!line.trim()) {
      return line;
    }
    return proxyLine(absoluteUrl(line.trim(), baseUrl), source, endpoint);
  });
  if (!master && source === "rutube") {
    if (!rewritten.some((line) => line.startsWith("#EXT-X-PLAYLIST-TYPE"))) {
      const header = rewritten.findIndex((line) => line.startsWith("#EXTM3U"));
      rewritten.splice(header + 1, 0, "#EXT-X-PLAYLIST-TYPE:VOD");
    }
    if (!rewritten.some((line) => line.startsWith("#EXT-X-ENDLIST"))) {
      rewritten.push("#EXT-X-ENDLIST");
    }
  }
  return rewritten.join("\n");
}

/**
 * DASH manifests reference segments through BaseURL and SegmentTemplate
 * attributes. Resolve them against the manifest (or its BaseURL), then send
 * every reference through the same proxy endpoint.
 */
export function rewriteDashManifest(body: string, baseUrl: string, source: string, endpoint: string): string {
  const baseMatch = body.match(/<BaseURL[^>]*>([^<]*)<\/BaseURL>/i);
  const declaredBase = baseMatch?.[1]?.trim();
  const segmentBase = declaredBase ? absoluteUrl(declaredBase, baseUrl) : baseUrl;
  const replaceBase = (reference: string): string =>
    xmlAttribute(proxyTemplateLine(absoluteUrl(reference, baseUrl), source, endpoint));
  const replaceSegment = (reference: string): string =>
    xmlAttribute(proxyTemplateLine(absoluteUrl(reference, segmentBase), source, endpoint));
  return body
    .replace(/(<BaseURL[^>]*>)([^<]*)(<\/BaseURL>)/gi, (_match, open: string, value: string, close: string) => {
      if (!value.trim()) return `${open}${value}${close}`;
      return `${open}${replaceBase(value.trim())}${close}`;
    })
    .replace(/\b(media|initialization|sourceURL)="([^"]*)"/gi, (_match, name: string, value: string) => {
      if (!value || value.startsWith(endpoint)) return `${name}="${value}"`;
      return `${name}="${replaceSegment(value)}"`;
    });
}
