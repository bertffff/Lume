/**
 * Unambiguous alphabet shared by invite-code generation and parsing.
 *
 * This mirrors the existing server-side generator alphabet and deliberately
 * omits look-alike glyphs (i, l, o, 0, 1) so codes stay safe to type and read.
 * Keep it in sync with the generator; it is the single source of truth for
 * what counts as a valid code character.
 */
export const ROOM_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const bareCodePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`, "i");
const groupedCodePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{3}-[${ROOM_CODE_ALPHABET}]{3}$`, "i");

/**
 * Parse user-supplied invite text into a canonical six-character lowercase code.
 *
 * Accepts a bare six-character code or an optional single hyphen in exactly
 * the 3-3 position (e.g. `7KQ-2MX`), and ignores whitespace at the edges.
 * Anything else — wrong length, ambiguous glyphs, or malformed grouping —
 * returns `null` so callers can reject it with recoverable "not found" UX.
 */
export function parseRoomCode(input: string): string | null {
  const value = input.trim();
  if (bareCodePattern.test(value)) {
    return value.toLowerCase();
  }
  if (groupedCodePattern.test(value)) {
    return value.replace("-", "").toLowerCase();
  }
  return null;
}

/**
 * Format a canonical code for display as uppercase, hyphenated 3-3 text.
 *
 * Precondition: `code` is a canonical six-character lowercase invite code,
 * such as the value returned by `parseRoomCode` or the code stored on a room.
 * Callers must run untrusted input through `parseRoomCode` first; this
 * function trusts its input and does not validate or reject malformed values.
 */
export function formatRoomCode(code: string): string {
  const upper = code.toUpperCase();
  return `${upper.slice(0, 3)}-${upper.slice(3)}`;
}
