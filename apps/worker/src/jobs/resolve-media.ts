import { ExtractorRegistry, type ResolvedMedia } from "@lume/contracts";

export const mediaResolveQueue = "media.resolve";

export interface MediaResolveJob {
  input: string;
  requestedBy: string;
}

export type MediaResolveResult =
  | { status: "no_extractor"; input: string }
  | { status: "resolved"; media: ResolvedMedia };

/** Empty on purpose. Provider adapters, including yt-dlp, are a later phase. */
export const extractorRegistry = new ExtractorRegistry([]);

export async function resolveMedia(job: MediaResolveJob): Promise<MediaResolveResult> {
  const extractor = extractorRegistry.find(job.input);
  if (!extractor) {
    return { status: "no_extractor", input: job.input };
  }
  return { status: "resolved", media: await extractor.resolve(job.input) };
}
