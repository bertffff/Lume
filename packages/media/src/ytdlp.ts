import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { MediaExtractor } from "@lume/contracts";
import { aspectFrom, media, type ExecFileImpl, type MediaConfig } from "./types.js";

const execFile = promisify(execFileCallback);

interface YtDlpBody {
  title?: string;
  duration?: number;
  width?: number;
  height?: number;
  url?: string;
  ext?: string;
  is_live?: boolean;
  manifest_url?: string;
  webpage_url?: string;
  id?: string;
  extractor_key?: string;
  requested_formats?: Array<{ url?: string; ext?: string; vcodec?: string; acodec?: string }>;
}

const directExt = new Set(["mp4", "webm", "mkv", "m4a", "mp3", "ogg", "mov"]);

export function createYtDlpExtractor(config: MediaConfig = {}): MediaExtractor {
  const path = config.ytdlpPath;
  const run: ExecFileImpl =
    config.execFileImpl ??
    (async (file, args, options) => {
      const result = await execFile(file, [...args], {
        timeout: options.timeout,
        maxBuffer: options.maxBuffer,
        windowsHide: true,
      });
      return result.stdout;
    });

  return {
    id: "ytdlp",
    canHandle: (input) => Boolean(path) && /^https?:\/\//i.test(input),
    async resolve(input) {
      if (!path) throw new Error("ytdlp_unconfigured");
      const stdout = await run(
        path,
        ["--dump-json", "--no-download", "--no-playlist", "--no-warnings", input],
        { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
      );
      let body: YtDlpBody;
      try {
        const parsed = JSON.parse(stdout) as YtDlpBody | YtDlpBody[];
        body = Array.isArray(parsed) ? (parsed[0] ?? {}) : parsed;
      } catch {
        throw new Error("ytdlp_bad_output");
      }
      let playbackUrl = body.is_live && body.manifest_url ? body.manifest_url : body.url;
      if (!playbackUrl) {
        const merged = (body.requested_formats ?? []).find((format) => format.url && format.vcodec !== "none");
        playbackUrl = merged?.url;
      }
      if (!playbackUrl) throw new Error("ytdlp_no_stream");
      const ext = body.ext ?? "";
      const kind = body.is_live || playbackUrl.includes(".m3u8") ? "hls" : directExt.has(ext) || !ext ? "file" : "file";
      let externalId = body.id ?? input;
      if (!body.id) {
        try {
          const parsed = new URL(input);
          externalId = `${parsed.hostname}${parsed.pathname}`;
        } catch {
          externalId = input;
        }
      }
      return media(body.extractor_key?.toLowerCase() ?? "ytdlp", externalId, body.title ?? externalId, {
        kind,
        url: playbackUrl,
      }, {
        durationMs: typeof body.duration === "number" && body.duration > 0 ? Math.round(body.duration * 1000) : null,
        aspectRatio: aspectFrom(body.width, body.height),
      });
    },
  };
}
