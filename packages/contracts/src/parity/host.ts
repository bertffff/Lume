import type { MemberRole } from "../roles.js";

export interface HostCandidate {
  userId: string;
  role: MemberRole;
  joinedAtMs: number;
}

/** Prefer a moderator, otherwise the member who joined earliest. */
export function hostLeavePauses(role: string): boolean {
  return role === "host";
}

export function nextHost(members: readonly HostCandidate[], leavingUserId: string): string | null {
  const rest = members.filter((member) => member.userId !== leavingUserId);
  if (rest.length === 0) {
    return null;
  }
  const mods = rest
    .filter((member) => member.role === "mod")
    .sort((left, right) => left.joinedAtMs - right.joinedAtMs);
  if (mods[0]) {
    return mods[0].userId;
  }
  return [...rest].sort((left, right) => left.joinedAtMs - right.joinedAtMs)[0]?.userId ?? null;
}

export function reclaimHost(input: {
  permanentHostId: string;
  joiningUserId: string;
  currentHostId: string;
}): boolean {
  return input.joiningUserId === input.permanentHostId && input.currentHostId !== input.permanentHostId;
}
