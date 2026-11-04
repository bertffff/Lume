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
