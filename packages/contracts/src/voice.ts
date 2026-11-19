import { z } from "zod";

export const voiceJoinSchema = z.object({
  roomId: z.string().min(1),
});

export const voiceStateSchema = z.object({
  roomId: z.string().min(1),
  muted: z.boolean(),
  speaking: z.boolean(),
});

export const voiceMuteSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1).optional(),
});

export const voiceDisconnectSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
});

export const voiceMemberSchema = z.object({
  userId: z.string().min(1),
  muted: z.boolean(),
  speaking: z.boolean(),
});

export type VoiceMember = z.infer<typeof voiceMemberSchema>;

export const preflightNetworks = ["good", "fair", "poor"] as const;
export type PreflightNetwork = (typeof preflightNetworks)[number];

export interface NetworkPreflightInput {
  effectiveType?: string | undefined;
  downlink?: number | undefined;
  rtt?: number | undefined;
  saveData?: boolean | undefined;
}

/** Mirrors the legacy classifyNetworkPreflight tiers: poor, fair, or good. */
export function classifyNetworkPreflight(input: NetworkPreflightInput): PreflightNetwork {
  if (input.saveData) return "poor";
  if (input.effectiveType === "slow-2g" || input.effectiveType === "2g") return "poor";
  if (typeof input.rtt === "number" && input.rtt > 400) return "poor";
  if (input.effectiveType === "3g") return "fair";
  if (typeof input.downlink === "number" && input.downlink < 1) return "poor";
  if (typeof input.downlink === "number" && input.downlink < 3) return "fair";
  if (typeof input.rtt === "number" && input.rtt > 150) return "fair";
  return "good";
}
