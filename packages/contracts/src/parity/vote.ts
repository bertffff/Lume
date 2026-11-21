export function votesNeeded(memberCount: number): number {
  return Math.max(1, Math.ceil(memberCount / 2));
}

export function castSkipVote(input: {
  memberCount: number;
  votes: readonly string[];
  voterId: string;
  isHost: boolean;
}): { votes: string[]; needed: number; skipped: boolean } {
  const needed = votesNeeded(input.memberCount);
  const votes = input.votes.includes(input.voterId) ? [...input.votes] : [...input.votes, input.voterId];
  return { votes, needed, skipped: input.isHost || votes.length >= needed };
}

export function withdrawSkipVote(votes: readonly string[], voterId: string): string[] {
  return votes.filter((id) => id !== voterId);
}
