/** Free rooms stop accepting new members at this count. No entitlement raises it yet. */
export const FREE_ROOM_MEMBER_CAP = 25;

/** Show a soft warning. The session is not ended and nobody is removed. */
export const SESSION_SOFT_WARN_MS = 4 * 60 * 60 * 1000;

export function roomOverMemberCap(
  activeMembers: number,
  cap: number = FREE_ROOM_MEMBER_CAP,
): boolean {
  return activeMembers >= cap;
}

export function sessionSoftWarn(createdAtMs: number, nowMs: number): boolean {
  return nowMs - createdAtMs >= SESSION_SOFT_WARN_MS;
}
