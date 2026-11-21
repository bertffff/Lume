import type { MediaExtractor } from "@lume/contracts";
import { fetchJson, media, type MediaConfig } from "./types.js";

interface CobaltBody {
  status?: string;
  url?: string;
  filename?: string;
  error?: { code?: string };
}

export function createCobaltExtractor(config: MediaConfig = {}): MediaExtractor {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 20_000;
  const base = (config.cobaltApiUrl ?? "").replace(/\/$/, "");

  return {
    id: "cobalt",
    canHandle: (input) => Boolean(base) && /^https?:\/\//i.test(input),
    async resolve(input) {
      if (!base) throw new Error("cobalt_unconfigured");
      const body = (await fetchJson(
        fetchImpl,
        `${base}/`,
        {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ url: input, videoQuality: "1080" }),
        },
        timeoutMs,
      )) as CobaltBody | null;
      if (!body) throw new Error("cobalt_unreachable");
      if (body.status === "error" || !body.url) {
        throw new Error(`cobalt_${body.error?.code ?? "no_stream"}`);
      }
      if (body.status !== "tunnel" && body.status !== "redirect") {
        throw new Error(`cobalt_${body.status ?? "unsupported"}`);
      }
      let externalId: string;
      try {
        const parsed = new URL(input);
        externalId = `${parsed.hostname}${parsed.pathname}`;
      } catch {
        externalId = input;
      }
      return media("cobalt", externalId, body.filename ?? externalId, {
        kind: "file",
        url: body.url,
      });
    },
  };
}
