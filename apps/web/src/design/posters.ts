const seedPosters = ["/dev-seed/desert.jpg", "/dev-seed/forest.jpg", "/dev-seed/rain.jpg", "/dev-seed/concert.jpg"] as const;

/** Real thumbnail when the item has one. Otherwise a committed Unsplash still for empty seed cards. */
export function posterFor(seed: string, thumbnail?: string | null): string {
  if (thumbnail && thumbnail.length > 0) return thumbnail;
  let index = 0;
  for (let cursor = 0; cursor < seed.length; cursor += 1) index = (index + seed.charCodeAt(cursor)) % seedPosters.length;
  return seedPosters[index] ?? seedPosters[0];
}
