export type FriendshipState = "pending" | "accepted" | "blocked";

export interface FriendshipEdge {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipState;
}

export type FriendDecision =
  | { action: "reject"; reason: "self" | "blocked" }
  | { action: "noop" }
  | { action: "accept"; id: string }
  | { action: "create" };

export function decideFriendRequest(actorId: string, targetId: string, edges: readonly FriendshipEdge[]): FriendDecision {
  if (actorId === targetId) {
    return { action: "reject", reason: "self" };
  }
  if (edges.some((edge) => edge.status === "blocked")) {
    return { action: "reject", reason: "blocked" };
  }
  if (edges.some((edge) => edge.status === "accepted")) {
    return { action: "noop" };
  }
  const outgoing = edges.find((edge) => edge.requesterId === actorId && edge.status === "pending");
  if (outgoing) {
    return { action: "noop" };
  }
  const incoming = edges.find((edge) => edge.addresseeId === actorId && edge.status === "pending");
  if (incoming) {
    return { action: "accept", id: incoming.id };
  }
  return { action: "create" };
}

export function mentionsUser(body: string, username: string | null, displayName: string): boolean {
  const names = [displayName, username].filter((name): name is string => Boolean(name && name.trim()));
  return names.some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\s)@${escaped}(?=\\s|$|[.,!?])`, "i").test(body);
  });
}

export function canToggleReaction(existingEmojis: readonly string[], emoji: string): boolean {
  if (existingEmojis.includes(emoji)) {
    return true;
  }
  return existingEmojis.length < 3;
}

export function extractTimecodeSeconds(body: string): number | null {
  const query = body.match(/[?&]t=(\d{1,6})/i);
  if (query?.[1]) {
    return Number(query[1]);
  }
  const clock = body.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (!clock) {
    return null;
  }
  const a = Number(clock[1]);
  const b = Number(clock[2]);
  if (clock[3] !== undefined) {
    return a * 3600 + b * 60 + Number(clock[3]);
  }
  return a * 60 + b;
}
