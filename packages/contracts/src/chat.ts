import { z } from "zod";

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  body: z.string().min(1).max(2000),
  replyToId: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  reactions: z.array(
    z.object({
      emoji: z.string().min(1).max(16),
      userId: z.string().min(1),
    }),
  ),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatSendSchema = z.object({
  roomId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
  replyToId: z.string().min(1).nullable().optional(),
});

export const chatReactSchema = z.object({
  roomId: z.string().min(1),
  messageId: z.string().min(1),
  emoji: z.string().trim().min(1).max(16),
});
