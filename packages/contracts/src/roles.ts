import { z } from "zod";

export const memberRoleSchema = z.enum(["host", "mod", "viewer"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export function canControlPlayback(role: MemberRole): boolean {
  return role === "host" || role === "mod";
}

export function canModerate(role: MemberRole): boolean {
  return role === "host" || role === "mod";
}

/** Host may kick or mute a mod or a viewer. A mod may kick or mute a viewer. */
export function canActOnMember(actor: MemberRole, target: MemberRole): boolean {
  if (target === "host") {
    return false;
  }
  if (actor === "host") {
    return true;
  }
  return actor === "mod" && target === "viewer";
}

export function canAssignRole(actor: MemberRole): boolean {
  return actor === "host";
}
