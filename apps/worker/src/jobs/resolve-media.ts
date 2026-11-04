import { ExtractorRegistry, extractorsEnabled, type ResolvedMedia } from "@lume/contracts";

export const mediaResolveQueue = "media.resolve";

export interface MediaResolveJob {
  input: string;
  requestedBy: string;
}

export type MediaResolveResult =
  | { status: "no_extractor"; input: string }
  | { status: "resolved"; media: ResolvedMedia };

/** Empty on purpose. yt-dlp stays out. The flag only unlocks this registry. */
export const extractorRegistry = new ExtractorRegistry([]);

export async function resolveMedia(
  job: MediaResolveJob,
  flag: string | undefined = process.env.FF_EXTRACTORS,
): Promise<MediaResolveResult> {
  if (!extractorsEnabled(flag)) {
    return { status: "no_extractor", input: job.input };
  }
  const extractor = extractorRegistry.find(job.input);
  if (!extractor) {
    return { status: "no_extractor", input: job.input };
  }
  return { status: "resolved", media: await extractor.resolve(job.input) };
}
