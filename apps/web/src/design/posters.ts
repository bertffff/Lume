/**
 * Only a real thumbnail is returned. Cards without a thumbnail fall back to the
 * neutral gradient defined in CSS, never to a stock photo.
 */
export function posterFor(_seed: string, thumbnail?: string | null): string | null {
  return thumbnail && thumbnail.length > 0 ? thumbnail : null;
}

/** Inline background for a card that has a real thumbnail. */
export function posterStyle(seed: string, thumbnail?: string | null): { backgroundImage: string } | undefined {
  const src = posterFor(seed, thumbnail);
  return src ? { backgroundImage: `url(${src})` } : undefined;
}
