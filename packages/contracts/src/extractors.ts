import { z } from "zod";

export const resolvedMediaSchema = z.object({
  provider: z.string().min(1),
  externalId: z.string().min(1),
  title: z.string().min(1),
  durationMs: z.number().int().nonnegative().nullable(),
  aspectRatio: z.number().positive().nullable(),
  playback: z
    .object({
      kind: z.enum(["embed", "hls", "file"]),
      url: z.string().min(1),
    })
    .nullable(),
});

export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;

/**
 * Provider boundary. Implementations (including yt-dlp) stay out of this
 * phase: the registry can be empty and jobs report `no_extractor`.
 */
export interface MediaExtractor {
  readonly id: string;
  canHandle(input: string): boolean;
  resolve(input: string): Promise<ResolvedMedia>;
}

/** Off unless FF_EXTRACTORS is exactly `1` or `true`. Embed playback does not use this. */
export function extractorsEnabled(flag: string | undefined): boolean {
  return flag === "1" || flag === "true";
}

export class ExtractorRegistry {
  constructor(private readonly extractors: readonly MediaExtractor[]) {}

  find(input: string): MediaExtractor | null {
    return this.extractors.find((extractor) => extractor.canHandle(input)) ?? null;
  }
}
