import { strToU8, zipSync } from "fflate";

export function exportZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, contents] of Object.entries(files)) {
    entries[name] = strToU8(contents);
  }
  return zipSync(entries);
}

export function isDueForPurge(
  user: { deletedAt: Date | null; scheduledDeletionAt: Date | null },
  now: Date,
): boolean {
  return user.deletedAt !== null && user.scheduledDeletionAt !== null && user.scheduledDeletionAt.getTime() <= now.getTime();
}

export const purgeRepeat = { pattern: "0 3 * * *" };
